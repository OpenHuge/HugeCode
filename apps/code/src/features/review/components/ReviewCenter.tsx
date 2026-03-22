import type { ReactNode } from "react";

type ReviewCenterProps = {
  activeWorkspace: boolean;
  showDetail: boolean;
  topbarLeftNode: ReactNode;
  diffListNode: ReactNode;
  diffViewerNode: ReactNode;
  detailAsideNode?: ReactNode;
  emptyNode: ReactNode;
  backNode?: ReactNode;
  listWrapperClassName?: string;
  viewerWrapperClassName?: string;
};

export function ReviewCenter({
  activeWorkspace,
  showDetail,
  topbarLeftNode,
  diffListNode,
  diffViewerNode,
  detailAsideNode,
  emptyNode,
  backNode,
  listWrapperClassName,
  viewerWrapperClassName,
}: ReviewCenterProps) {
  if (!activeWorkspace) {
    return emptyNode;
  }

  if (showDetail) {
    return (
      <>
        {backNode}
        <div className={viewerWrapperClassName}>{diffViewerNode}</div>
      </>
    );
  }

  return (
    <>
      {topbarLeftNode}
      {backNode}
      <div className={listWrapperClassName}>
        {diffListNode}
        {detailAsideNode}
      </div>
    </>
  );
}
