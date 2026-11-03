/** Instruções de como fotografar o imóvel. Usado na página "Guia" e no passo de envio das fotos. */
export const SHOT_ORDER = [
  { icon: '🏠', name: 'Fachada / Entrada', tip: 'Comece de fora, em frente à porta principal. É a primeira cena do tour.' },
  { icon: '🛋️', name: 'Sala', tip: 'Câmera no centro do ambiente, longe dos móveis.' },
  { icon: '🍳', name: 'Cozinha', tip: 'Portas de armário fechadas e bancada organizada.' },
  { icon: '🚪', name: 'Corredor', tip: 'Ajuda o cliente a entender como os cômodos se ligam.' },
  { icon: '🛏️', name: 'Quartos / Suítes', tip: 'Um ponto por quarto. Cama arrumada, cortinas abertas.' },
  { icon: '🚿', name: 'Banheiros', tip: 'Tampa do vaso baixada, toalhas dobradas, espelho limpo.' },
  { icon: '🧺', name: 'Lavanderia / Varanda', tip: 'Fotografe no centro, de dia.' },
  { icon: '🚗', name: 'Garagem e área externa', tip: 'Por último. Mostre vagas, piscina e lazer.' },
];

export default function PhotoGuide({ compact = false }: { compact?: boolean }) {
  return (
    <div className="guide">
      <section className="guide-block">
        <h3>1. Qual tipo de foto usar</h3>
        <div className="guide-types">
          <div className="guide-type best">
            <span className="tag tag-green">Melhor resultado</span>
            <b>Foto 360° (2:1)</b>
            <p>Câmera 360 (Insta360, Ricoh Theta) ou app de foto esférica. O cliente olha para todos os lados: teto, chão e paredes.</p>
            <div className="ratio r21">2 : 1</div>
          </div>
          <div className="guide-type">
            <span className="tag tag-blue">Bom</span>
            <b>Panorâmica do celular</b>
            <p>Modo "Panorama" da câmera, girando o corpo devagar. O cliente gira para os lados.</p>
            <div className="ratio r41">4 : 1 ou mais</div>
          </div>
          <div className="guide-type">
            <span className="tag tag-gray">Básico</span>
            <b>Foto comum</b>
            <p>Funciona, mas o movimento é limitado. Use a lente grande-angular (0.5x).</p>
            <div className="ratio r43">4 : 3</div>
          </div>
        </div>
      </section>

      <section className="guide-block">
        <h3>2. Como posicionar a câmera</h3>
        <ul className="checklist">
          <li><b>Centro do cômodo:</b> fique no meio do ambiente, a pelo menos 1 m dos móveis.</li>
          <li><b>Altura dos olhos:</b> tripé ou bastão a ~1,50 m do chão, sempre na mesma altura.</li>
          <li><b>Câmera reta:</b> nivelada, sem inclinar. Linhas das paredes devem ficar retas.</li>
          <li><b>Saia da foto:</b> na câmera 360, dispare pelo app do celular, de outro cômodo.</li>
          <li><b>Luz:</b> todas as luzes acesas, cortinas abertas, prefira o dia (10h–15h).</li>
          <li><b>Organização:</b> retire objetos pessoais, roupas, lixeiras e animais.</li>
        </ul>
      </section>

      <section className="guide-block">
        <h3>3. Ordem das fotos (o caminho do visitante)</h3>
        <p className="muted">Fotografe e envie nesta ordem, como se estivesse levando o cliente pela casa. Assim os cômodos se conectam de forma natural.</p>
        <ol className="shot-order">
          {SHOT_ORDER.map((s, i) => (
            <li key={s.name}>
              <span className="shot-n">{i + 1}</span>
              <span className="shot-icon">{s.icon}</span>
              <div><b>{s.name}</b>{!compact && <small>{s.tip}</small>}</div>
            </li>
          ))}
        </ol>
      </section>

      {!compact && (
        <section className="guide-block">
          <h3>4. Requisitos do arquivo</h3>
          <ul className="checklist">
            <li>Formato <b>JPG</b>, PNG ou WEBP, até <b>40 MB</b> por foto.</li>
            <li>Foto 360°: ideal <b>6000 × 3000 px</b> ou mais (mínimo 4000 × 2000).</li>
            <li>Não recorte nem edite a proporção de uma foto 360°.</li>
            <li><b>Uma foto por ponto.</b> Cômodos grandes podem ter 2 pontos (ex.: "Sala - estar" e "Sala - jantar").</li>
          </ul>
        </section>
      )}
    </div>
  );
}
