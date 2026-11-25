import ScheduleView from '@/components/ScheduleView';

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Titles marked Watching appear here automatically.
        </p>
      </div>
      <ScheduleView />
    </div>
  );
}
