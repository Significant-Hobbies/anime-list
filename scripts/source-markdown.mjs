import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Interpret only authored JSX and literal data. Never execute hooks, fetch data,
// render HTML, or inspect browser/user state.
const skip = new Set([
  'TokenManager',
  'TokenRow',
  'CatalogTotals',
  'DiscoveryQueue',
  'AnimeIdentityQuiz',
  'ResourceBoundary',
  'CompactSectionSkeleton',
]);
const decode = (text) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ');
const clean = (text) =>
  text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

class SourceReader {
  constructor(file, initial) {
    this.source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    this.scope = {
      SITE_NAME: 'Anime List',
      SITE_TAGLINE: 'Discover anime & manga',
      API_URL: 'https://anime.significanthobbies.com',
      user: null,
      authLoading: false,
      quizAboveFold: false,
      ...initial,
    };
    this.functions = new Map();
    for (const statement of this.source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name)
        this.functions.set(statement.name.text, statement);
      if (ts.isVariableStatement(statement))
        for (const item of statement.declarationList.declarations) {
          if (ts.isIdentifier(item.name))
            this.scope[item.name.text] = this.value(item.initializer, this.scope);
        }
    }
  }
  bind(name, val, env) {
    if (ts.isIdentifier(name)) env[name.text] = val;
    else if (ts.isArrayBindingPattern(name))
      name.elements.forEach((part, i) => this.bind(part.name, val?.[i], env));
  }
  value(node, env) {
    if (!node) return undefined;
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isNonNullExpression(node)
    )
      return this.value(node.expression, env);
    if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node))
      return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
    if (ts.isIdentifier(node)) return env[node.text];
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.NullKeyword)
      return false;
    return this.compound(node, env);
  }
  compound(node, env) {
    if (ts.isArrayLiteralExpression(node))
      return node.elements.map((child) => this.value(child, env));
    if (ts.isObjectLiteralExpression(node))
      return Object.fromEntries(
        node.properties
          .filter(ts.isPropertyAssignment)
          .map((item) => [item.name.text, this.value(item.initializer, env)])
      );
    if (ts.isPropertyAccessExpression(node))
      return this.value(node.expression, env)?.[node.name.text];
    if (ts.isElementAccessExpression(node))
      return this.value(node.expression, env)?.[this.value(node.argumentExpression, env)];
    if (ts.isTemplateExpression(node))
      return (
        node.head.text +
        node.templateSpans
          .map((part) => String(this.value(part.expression, env) ?? '') + part.literal.text)
          .join('')
      );
    return this.expression(node, env);
  }
  expression(node, env) {
    if (ts.isConditionalExpression(node))
      return this.value(this.value(node.condition, env) ? node.whenTrue : node.whenFalse, env);
    if (ts.isBinaryExpression(node)) {
      const left = this.value(node.left, env);
      if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
        return left && this.value(node.right, env);
      if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
        return left || this.value(node.right, env);
      if (node.operatorToken.kind === ts.SyntaxKind.PlusToken)
        return left + this.value(node.right, env);
      if (node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)
        return left !== this.value(node.right, env);
    }
    if (ts.isCallExpression(node)) return this.call(node, env);
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node))
      return this.jsx(node, env);
    return undefined;
  }
  call(node, env) {
    if (ts.isIdentifier(node.expression)) {
      const args = node.arguments.map((arg) => this.value(arg, env));
      if (node.expression.text === 'getApiUrl') return 'https://anime.significanthobbies.com';
      if (node.expression.text === 'formatDate') return args[0];
      if (node.expression.text === 'encodeURIComponent') return encodeURIComponent(args[0]);
      if (node.expression.text === 'serializeFilters') return JSON.stringify({ f: args[0] });
    }
    if (!ts.isPropertyAccessExpression(node.expression)) return undefined;
    const receiver = this.value(node.expression.expression, env);
    if (node.expression.name.text !== 'map' || !Array.isArray(receiver)) return undefined;
    const callback = node.arguments[0];
    if (!ts.isArrowFunction(callback)) return undefined;
    return receiver
      .map((item, index) => {
        const local = { ...env };
        this.bind(callback.parameters[0].name, item, local);
        if (callback.parameters[1]) this.bind(callback.parameters[1].name, index, local);
        return this.value(callback.body, local) ?? '';
      })
      .join('');
  }
  invoke(name, props, env) {
    if (skip.has(name)) return '';
    const fn = this.functions.get(name);
    if (!fn) return '';
    const local = { ...env, ...props };
    const ret = fn.body.statements.find(ts.isReturnStatement);
    return ret ? (this.value(ret.expression, local) ?? '') : '';
  }
  jsx(node, env) {
    if (ts.isJsxFragment(node)) return this.children(node.children, env);
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    const tag = opening.tagName.getText(this.source);
    const attrs = {};
    for (const attr of opening.attributes.properties)
      if (ts.isJsxAttribute(attr)) {
        attrs[attr.name.text] = !attr.initializer
          ? true
          : ts.isStringLiteral(attr.initializer)
            ? attr.initializer.text
            : this.value(attr.initializer.expression, env);
      }
    if (attrs['aria-hidden'] || ['svg', 'script', 'style'].includes(tag)) return '';
    if (skip.has(tag)) return '';
    if (this.functions.has(tag)) return this.invoke(tag, attrs, env);
    const body = ts.isJsxElement(node) ? this.children(node.children, env) : '';
    return this.block(tag, attrs, body);
  }
  block(tag, attrs, body) {
    const text = clean(body);
    if (tag === 'a' || tag === 'Link') {
      const target = attrs.href || attrs.to;
      return target && text
        ? `[${text.replace(/\s+/g, ' ')}](${new URL(target + (attrs.hash ? '#' + attrs.hash : ''), 'https://anime.significanthobbies.com').href})`
        : body;
    }
    if (/^h[1-6]$/.test(tag)) return `\n\n${'#'.repeat(Number(tag[1]))} ${text}\n\n`;
    if (tag === 'pre') return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
    if (tag === 'li') return `\n- ${text}\n`;
    if (tag === 'img' && attrs.alt)
      return `![${attrs.alt}](${new URL(attrs.src, 'https://anime.significanthobbies.com').href})`;
    if (
      [
        'p',
        'section',
        'article',
        'div',
        'main',
        'header',
        'ul',
        'ol',
        'details',
        'summary',
        'nav',
      ].includes(tag)
    )
      return `\n\n${text}\n\n`;
    return body;
  }
  renderValue(value) {
    return value == null || typeof value === 'boolean' ? '' : value;
  }
  children(nodes, env) {
    return nodes
      .map((node) =>
        ts.isJsxText(node)
          ? decode(node.text)
          : ts.isJsxExpression(node)
            ? this.renderValue(this.value(node.expression, env))
            : (this.value(node, env) ?? '')
      )
      .join('');
  }
}

export function sourceMarkdown(file, component, initial = {}) {
  const reader = new SourceReader(file, initial);
  return clean(reader.invoke(component, {}, reader.scope)) + '\n';
}
