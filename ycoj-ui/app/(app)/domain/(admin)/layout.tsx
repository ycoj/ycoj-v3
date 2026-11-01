import DomainSidebar from '@/features/domain/domain-sidebar';
import { getDomainViewer } from '@/features/domain/lib/get-domain-page';
import TwoColumnLayout from '@/shared/layout/two-column';

export default async function DomainAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Access is enforced by each page's loader; this layout only supplies the
  // domain-management navigation shared by all admin routes.
  await getDomainViewer();
  return (
    <TwoColumnLayout
      left={children}
      right={<DomainSidebar />}
      ratio="8-2"
      gap="gap-6"
    />
  );
}
