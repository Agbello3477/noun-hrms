import StaffDetailClient from './StaffDetailClient';

export async function generateStaticParams() {
    return [{ id: 'default' }];
}

export default function Page({ params }: { params: { id: string } }) {
    return <StaffDetailClient params={params} />;
}
