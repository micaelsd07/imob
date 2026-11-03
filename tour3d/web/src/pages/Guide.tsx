import Layout from '../components/Layout';
import PhotoGuide from '../components/PhotoGuide';

export default function Guide() {
  return (
    <Layout>
      <div className="page-head">
        <div>
          <h1>Guia de fotos</h1>
          <p className="muted">Como fotografar o imóvel para gerar um tour 3D de qualidade.</p>
        </div>
      </div>
      <div className="card"><PhotoGuide /></div>
    </Layout>
  );
}
