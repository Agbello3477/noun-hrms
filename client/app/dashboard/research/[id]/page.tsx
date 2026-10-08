import ResearchWorkspaceClient from './ResearchWorkspaceClient';

export async function generateStaticParams() {
    return [{ id: 'default' }];
}

export default function Page({ params }: { params: { id: string } }) {
    return <ResearchWorkspaceClient params={params} />;
}
