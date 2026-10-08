import StaffDossierClient from './StaffDossierClient';

export async function generateStaticParams() {
    return [{ id: 'default' }];
}

export default function Page({ params }: { params: { id: string } }) {
    return <StaffDossierClient params={params} />;
}
