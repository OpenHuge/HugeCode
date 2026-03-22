type WorkspaceGroupProps = {
  toggleId: string | null;
  name: string;
  showHeader: boolean;
  isCollapsed: boolean;
  onToggleCollapse: (groupId: string) => void;
  children: React.ReactNode;
};

export function WorkspaceGroup({
  toggleId,
  name,
  showHeader,
  isCollapsed,
  onToggleCollapse,
  children,
}: WorkspaceGroupProps) {
  const isToggleable = Boolean(toggleId);
  return (
    <div className="workspace-group">
      {showHeader && (
        <div className={`workspace-group-header${isToggleable ? " is-toggleable" : ""}`}>
          <div className="workspace-group-label">{name}</div>
          {isToggleable && (
            <button
              type="button"
              className={`group-toggle ${isCollapsed ? "" : "expanded"}`}
              onClick={(event) => {
                event.stopPropagation();
                if (!toggleId) {
                  return;
                }
                onToggleCollapse(toggleId);
              }}
              aria-label={isCollapsed ? "Expand group" : "Collapse group"}
              aria-expanded={!isCollapsed}
            >
              <span className="group-toggle-icon">›</span>
            </button>
          )}
        </div>
      )}
      <div className={`workspace-group-list ${isCollapsed ? "collapsed" : ""}`}>
        <div className="workspace-group-content">{children}</div>
      </div>
    </div>
  );
}
