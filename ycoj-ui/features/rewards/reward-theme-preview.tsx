export default function RewardThemePreview({ id }: { id: string }) {
  return (
    <div
      className="reward-theme-thumbnail reward-theme-canvas"
      data-reward-accent={id}
      aria-hidden="true"
    >
      <div className="reward-theme-thumbnail-nav">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="reward-theme-thumbnail-main">
        <span className="mb-1 text-xs font-semibold text-primary">YCOJ</span>
        <span className="reward-theme-thumbnail-row" />
        <span className="reward-theme-thumbnail-row" />
        <span className="reward-theme-thumbnail-action" />
      </div>
    </div>
  );
}
