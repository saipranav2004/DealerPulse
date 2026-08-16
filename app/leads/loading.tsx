import { TableSkeleton } from '@/components/skeletons';

export default function LeadsLoading() {
  return <TableSkeleton label="Loading leads" rows={14} />;
}
