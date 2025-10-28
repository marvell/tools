import { buildInfo } from "../buildInfo";

export function Footer() {
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="text-center text-sm text-muted-foreground space-y-1">
      <p>Built with Bun and React</p>
      <p className="text-xs">
        Build: <code className="px-1 py-0.5 bg-muted rounded">{buildInfo.gitHash}</code>
        {' • '}
        {formatDate(buildInfo.buildDate)}
      </p>
    </div>
  );
}
