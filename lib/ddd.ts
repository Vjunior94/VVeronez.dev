const DDD_MAP: Record<string, { cidade: string; estado: string; regiao: string }> = {
  '11': { cidade: 'São Paulo', estado: 'SP', regiao: 'Sudeste' },
  '12': { cidade: 'São José dos Campos', estado: 'SP', regiao: 'Sudeste' },
  '13': { cidade: 'Santos', estado: 'SP', regiao: 'Sudeste' },
  '14': { cidade: 'Bauru', estado: 'SP', regiao: 'Sudeste' },
  '15': { cidade: 'Sorocaba', estado: 'SP', regiao: 'Sudeste' },
  '16': { cidade: 'Ribeirão Preto', estado: 'SP', regiao: 'Sudeste' },
  '17': { cidade: 'São José do Rio Preto', estado: 'SP', regiao: 'Sudeste' },
  '18': { cidade: 'Presidente Prudente', estado: 'SP', regiao: 'Sudeste' },
  '19': { cidade: 'Campinas', estado: 'SP', regiao: 'Sudeste' },
  '21': { cidade: 'Rio de Janeiro', estado: 'RJ', regiao: 'Sudeste' },
  '22': { cidade: 'Campos dos Goytacazes', estado: 'RJ', regiao: 'Sudeste' },
  '24': { cidade: 'Volta Redonda', estado: 'RJ', regiao: 'Sudeste' },
  '27': { cidade: 'Vitória', estado: 'ES', regiao: 'Sudeste' },
  '28': { cidade: 'Cachoeiro de Itapemirim', estado: 'ES', regiao: 'Sudeste' },
  '31': { cidade: 'Belo Horizonte', estado: 'MG', regiao: 'Sudeste' },
  '32': { cidade: 'Juiz de Fora', estado: 'MG', regiao: 'Sudeste' },
  '33': { cidade: 'Governador Valadares', estado: 'MG', regiao: 'Sudeste' },
  '34': { cidade: 'Uberlândia', estado: 'MG', regiao: 'Sudeste' },
  '35': { cidade: 'Poços de Caldas', estado: 'MG', regiao: 'Sudeste' },
  '37': { cidade: 'Divinópolis', estado: 'MG', regiao: 'Sudeste' },
  '38': { cidade: 'Montes Claros', estado: 'MG', regiao: 'Sudeste' },
  '41': { cidade: 'Curitiba', estado: 'PR', regiao: 'Sul' },
  '42': { cidade: 'Ponta Grossa', estado: 'PR', regiao: 'Sul' },
  '43': { cidade: 'Londrina', estado: 'PR', regiao: 'Sul' },
  '44': { cidade: 'Maringá', estado: 'PR', regiao: 'Sul' },
  '45': { cidade: 'Foz do Iguaçu', estado: 'PR', regiao: 'Sul' },
  '46': { cidade: 'Pato Branco', estado: 'PR', regiao: 'Sul' },
  '47': { cidade: 'Joinville', estado: 'SC', regiao: 'Sul' },
  '48': { cidade: 'Florianópolis', estado: 'SC', regiao: 'Sul' },
  '49': { cidade: 'Chapecó', estado: 'SC', regiao: 'Sul' },
  '51': { cidade: 'Porto Alegre', estado: 'RS', regiao: 'Sul' },
  '53': { cidade: 'Pelotas', estado: 'RS', regiao: 'Sul' },
  '54': { cidade: 'Caxias do Sul', estado: 'RS', regiao: 'Sul' },
  '55': { cidade: 'Santa Maria', estado: 'RS', regiao: 'Sul' },
  '61': { cidade: 'Brasília', estado: 'DF', regiao: 'Centro-Oeste' },
  '62': { cidade: 'Goiânia', estado: 'GO', regiao: 'Centro-Oeste' },
  '63': { cidade: 'Palmas', estado: 'TO', regiao: 'Norte' },
  '64': { cidade: 'Rio Verde', estado: 'GO', regiao: 'Centro-Oeste' },
  '65': { cidade: 'Cuiabá', estado: 'MT', regiao: 'Centro-Oeste' },
  '66': { cidade: 'Rondonópolis', estado: 'MT', regiao: 'Centro-Oeste' },
  '67': { cidade: 'Campo Grande', estado: 'MS', regiao: 'Centro-Oeste' },
  '68': { cidade: 'Rio Branco', estado: 'AC', regiao: 'Norte' },
  '69': { cidade: 'Porto Velho', estado: 'RO', regiao: 'Norte' },
  '71': { cidade: 'Salvador', estado: 'BA', regiao: 'Nordeste' },
  '73': { cidade: 'Ilhéus', estado: 'BA', regiao: 'Nordeste' },
  '74': { cidade: 'Juazeiro', estado: 'BA', regiao: 'Nordeste' },
  '75': { cidade: 'Feira de Santana', estado: 'BA', regiao: 'Nordeste' },
  '77': { cidade: 'Vitória da Conquista', estado: 'BA', regiao: 'Nordeste' },
  '79': { cidade: 'Aracaju', estado: 'SE', regiao: 'Nordeste' },
  '81': { cidade: 'Recife', estado: 'PE', regiao: 'Nordeste' },
  '82': { cidade: 'Maceió', estado: 'AL', regiao: 'Nordeste' },
  '83': { cidade: 'João Pessoa', estado: 'PB', regiao: 'Nordeste' },
  '84': { cidade: 'Natal', estado: 'RN', regiao: 'Nordeste' },
  '85': { cidade: 'Fortaleza', estado: 'CE', regiao: 'Nordeste' },
  '86': { cidade: 'Teresina', estado: 'PI', regiao: 'Nordeste' },
  '87': { cidade: 'Petrolina', estado: 'PE', regiao: 'Nordeste' },
  '88': { cidade: 'Juazeiro do Norte', estado: 'CE', regiao: 'Nordeste' },
  '89': { cidade: 'Picos', estado: 'PI', regiao: 'Nordeste' },
  '91': { cidade: 'Belém', estado: 'PA', regiao: 'Norte' },
  '92': { cidade: 'Manaus', estado: 'AM', regiao: 'Norte' },
  '93': { cidade: 'Santarém', estado: 'PA', regiao: 'Norte' },
  '94': { cidade: 'Marabá', estado: 'PA', regiao: 'Norte' },
  '95': { cidade: 'Boa Vista', estado: 'RR', regiao: 'Norte' },
  '96': { cidade: 'Macapá', estado: 'AP', regiao: 'Norte' },
  '97': { cidade: 'Coari', estado: 'AM', regiao: 'Norte' },
  '98': { cidade: 'São Luís', estado: 'MA', regiao: 'Nordeste' },
  '99': { cidade: 'Imperatriz', estado: 'MA', regiao: 'Nordeste' },
};

export function getDDDInfo(numero: string) {
  const clean = numero.replace(/\D/g, '');
  let ddd = '';
  if (clean.startsWith('55') && clean.length >= 4) {
    ddd = clean.slice(2, 4);
  } else if (clean.length >= 2) {
    ddd = clean.slice(0, 2);
  }
  const info = DDD_MAP[ddd];
  return {
    ddd,
    cidade: info?.cidade || 'Desconhecida',
    estado: info?.estado || '??',
    regiao: info?.regiao || 'Desconhecida',
  };
}

export function formatPhone(numero: string) {
  const clean = numero.replace(/\D/g, '');
  if (clean.length === 13 && clean.startsWith('55')) {
    const ddd = clean.slice(2, 4);
    const p1 = clean.slice(4, 9);
    const p2 = clean.slice(9, 13);
    return `(${ddd}) ${p1}-${p2}`;
  }
  return `+${clean}`;
}
