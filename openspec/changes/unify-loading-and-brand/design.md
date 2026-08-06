# Design

## Direction

This is a preservation pass. The existing dark editorial interface remains intact. Loading UI should predict the final layout, stay visually quiet, respect reduced-motion preferences, and announce state changes to assistive technology without adding visible prose that shifts the page.

The product name remains **Anime List by Significant Hobbies**. Compact UI lockups stack a smaller, quieter **by Significant Hobbies** line beneath **Anime List**. Metadata and prose use the full name. Google sign-in remains the official GIS-rendered control for Safari compatibility, using Google's compact circular icon variant in the navbar.

## Loading model

- Route code loading uses a stable page shell below the persistent navigation.
- First data loads use shared shape primitives composed into catalog, list, stats, or compact-section skeletons.
- Auth resolution uses the same representative skeleton as the protected destination instead of returning `null`.
- Background refetches keep existing content fully legible and expose a thin progress indicator plus an accessible status message.
- Pending mutations keep their existing local disabled and label feedback.

## Verification

- Unit coverage checks shared loading semantics and current brand constants.
- Typecheck and production build pass.
- Browser screenshots at 390, 768, and 1440 pixels verify stable responsive composition.
- Reduced-motion and accessible status semantics receive a narrow audit.
