'use client';

export function DemoBrowser() {
  return (
    <div className="demo-browser">
      <div className="demo-browser-bar">
        <div className="demo-browser-dot" />
        <div className="demo-browser-dot" />
        <div className="demo-browser-dot" />
        <div className="demo-browser-url">www.suamarca.com.br</div>
      </div>
      <div className="demo-browser-content">
        <div className="demo-skeleton h1" />
        <div className="demo-skeleton p1" />
        <div className="demo-skeleton p2" />
        <div className="demo-skeleton p3" />
        <div className="demo-skeleton btn" />
      </div>
    </div>
  );
}

export function DemoPhone() {
  return (
    <div className="demo-phone">
      <div className="demo-phone-screen">
        <div className="demo-app-row">
          <div className="demo-app-circle" />
          <div className="demo-app-line" />
        </div>
        <div className="demo-app-row">
          <div className="demo-app-circle" style={{ background: 'var(--gold-300)' }} />
          <div className="demo-app-line short" />
        </div>
        <div className="demo-app-row">
          <div className="demo-app-circle" />
          <div className="demo-app-line" />
        </div>
        <div className="demo-app-row">
          <div className="demo-app-circle" style={{ background: 'var(--gold-300)' }} />
          <div className="demo-app-line short" />
        </div>
      </div>
    </div>
  );
}

export function DemoDashboard() {
  return (
    <div className="demo-dashboard">
      <div className="demo-metric">
        <div className="demo-metric-label">Vendas / mês</div>
        <div className="demo-metric-value">R$ 84k</div>
        <div className="demo-metric-bar" />
      </div>
      <div className="demo-metric">
        <div className="demo-metric-label">Conversão</div>
        <div className="demo-metric-value">12.4%</div>
        <div className="demo-metric-bar" />
      </div>
      <div className="demo-metric">
        <div className="demo-metric-label">Ticket médio</div>
        <div className="demo-metric-value">R$ 312</div>
        <div className="demo-metric-bar" />
      </div>
      <div className="demo-chart">
        <svg viewBox="0 0 300 80" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold-300)" stopOpacity={0.6} />
              <stop offset="100%" stopColor="var(--gold-300)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path
            className="demo-chart-area"
            d="M0,60 L40,55 L80,40 L120,48 L160,30 L200,38 L240,18 L280,22 L300,12 L300,80 L0,80 Z"
          />
          <path
            className="demo-chart-line"
            d="M0,60 L40,55 L80,40 L120,48 L160,30 L200,38 L240,18 L280,22 L300,12"
          />
        </svg>
      </div>
    </div>
  );
}

export function DemoFlow() {
  return (
    <div className="demo-flow">
      <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
        <path className="demo-flow-edge e1" d="M 80,50 Q 130,50 130,100 Q 130,150 180,150" />
        <path className="demo-flow-edge e2" d="M 220,150 Q 270,150 270,100 Q 270,50 320,50" />
        <path className="demo-flow-edge e3" d="M 220,150 Q 270,150 270,150" />

        <rect className="demo-flow-node n1" x="20" y="35" width="120" height="30" rx="4" />
        <text className="demo-flow-text t1" x="80" y="50">Lead recebido</text>

        <rect className="demo-flow-node n2" x="120" y="135" width="100" height="30" rx="4" />
        <text className="demo-flow-text t2" x="170" y="150">IA qualifica</text>

        <rect className="demo-flow-node n3" x="260" y="35" width="120" height="30" rx="4" />
        <text className="demo-flow-text t3" x="320" y="50">CRM atualizado</text>

        <rect className="demo-flow-node n4" x="200" y="135" width="120" height="30" rx="4" />
        <text className="demo-flow-text t4" x="260" y="150">Email enviado</text>

        <circle className="demo-flow-pulse" cx="80" cy="50" r="3">
          <animateMotion
            dur="3s"
            begin="2.5s"
            repeatCount="indefinite"
            path="M 0,0 Q 50,0 50,50 Q 50,100 100,100"
          />
        </circle>
      </svg>
    </div>
  );
}

export function DemoCheckout() {
  return (
    <div className="demo-checkout">
      <div className="demo-product">
        <div className="demo-product-img" />
        <div className="demo-product-info">
          <div className="demo-product-name">Produto premium · Qtd 1</div>
          <div className="demo-product-price">R$ 289,90</div>
        </div>
      </div>
      <div className="demo-checkout-row">
        <span>Subtotal</span>
        <span>R$ 289,90</span>
      </div>
      <div className="demo-checkout-row">
        <span>Frete (PR · SEDEX)</span>
        <span>R$ 24,50</span>
      </div>
      <div className="demo-checkout-row total">
        <span>Total</span>
        <span>R$ 314,40</span>
      </div>
      <div className="demo-checkout-btn">Finalizar via Pix →</div>
    </div>
  );
}

export function DemoChat() {
  return (
    <div className="demo-chat">
      <div className="demo-msg demo-msg-user">
        Quanto custa pra fazer um app pro meu negócio?
      </div>
      <div className="demo-msg demo-msg-bot">
        Pra te dar um orçamento certeiro, preciso entender 3 coisas: o tipo de negócio, quantos
        usuários você espera atender e quais funções não podem faltar. Pode me contar?
      </div>
      <div className="demo-msg demo-msg-bot">
        <span className="demo-msg-typing">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}
