-- =============================================================================
-- Vale do Sol Imóveis — dados iniciais
--
-- Só entra aqui o que é comprovadamente real: os tipos de imóvel que a
-- imobiliária já usa no site atual e os dados de contato publicados por ela.
-- Nada de imóvel, cliente, depoimento ou número inventado.
-- Campos que ainda não conhecemos ficam vazios e aparecem no admin como
-- configuração pendente.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos de imóvel (taxonomia real do site atual)
-- ---------------------------------------------------------------------------
insert into public.property_types (name, slug, sort_order) values
  ('Casa em Bairro',        'casa-bairro',         10),
  ('Casa em Condomínio',    'casa-condominio',     20),
  ('Apartamento',           'apartamento',         30),
  ('Terreno em Bairro',     'terreno-bairro',      40),
  ('Terreno em Condomínio', 'terreno-condominio',  50),
  ('Terreno Comercial',     'terreno-comercial',   60),
  ('Chácara / Sítio',       'chacara-sitio',       70),
  ('Imóvel Comercial',      'comercial',           80),
  ('Galpão Industrial',     'galpao-industrial',   90),
  ('Área Industrial',       'area-industrial',    100),
  ('Imóvel no Litoral',     'imovel-litoral',     110)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Configurações do site
-- Fonte: página /contato/ e /sobre/ do site atual da Vale do Sol.
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value, is_public) values
  ('contact', jsonb_build_object(
      'phone',            '(11) 4655-3399',
      'phone_secondary',  '(11) 99987-6642',
      'whatsapp',         '5511999876642',
      'email',            'contato@valedosolimoveis.com.br',
      'email_secondary',  'franco@valedosolimoveis.com.br',
      'address',          'Avenida Antônio Afonso de Lima, 704',
      'district',         'Centro',
      'city',             'Arujá',
      'state',            'SP',
      'zip',              '07400-560',
      -- Horário de atendimento ainda não confirmado pela imobiliária.
      'hours',            '',
      -- Coordenadas do escritório: em branco até serem confirmadas.
      -- Enquanto vazias, a página de contato não desenha mapa nenhum, em vez
      -- de marcar um ponto aproximado e mandar o cliente ao lugar errado.
      'latitude',         '',
      'longitude',        ''
    ), true),

  ('social', jsonb_build_object(
      'facebook',  'https://www.facebook.com/Vale-do-Sol-Im%C3%B3veis-e-Consultoria-731877396834804/',
      'instagram', ''
    ), true),

  ('hero', jsonb_build_object(
      'title',      'Encontre seu próximo lugar em Arujá.',
      'subtitle',   'Casas, terrenos, condomínios, chácaras e imóveis comerciais selecionados por quem conhece Arujá.',
      'image_path', ''
    ), true),

  ('about', jsonb_build_object(
      'tagline', 'Desde 1975, construindo relações, negócios e histórias no mercado imobiliário.',
      'intro', 'Fundada em 1975, na cidade de Arujá, São Paulo, a Vale do Sol Empreendimentos Imobiliários nasceu da experiência de seu fundador, Leonardo Barbieri, italiano e veterano no mercado de vendas.',
      -- E'...' permite quebras de linha: os parágrafos são separados por linha em branco.
      'history', E'Ao longo de mais de cinco décadas, a empresa acompanhou o crescimento e a transformação de Arujá e região, construindo sua trajetória com base em conhecimento do mercado, relacionamento próximo com seus clientes e experiência em diferentes segmentos imobiliários.

Hoje, a Vale do Sol é conduzida pela segunda geração da família, Maria Barbieri, advogada, e Francisco Barbieri, o Franco, engenheiro mecânico especializado em corretagem de imóveis.

A união entre tradição e conhecimento continua sendo parte essencial da nossa forma de trabalhar. Mantemos os valores que deram origem à empresa, ao mesmo tempo em que acompanhamos a evolução do mercado e as novas necessidades de quem compra, vende, investe ou busca administrar um imóvel.',
      'specialties', 'Atuamos na compra, venda e intermediação de imóveis, oferecendo conhecimento e acompanhamento em diferentes tipos de propriedades.',
      -- Um segmento por linha, no formato: Título | descrição.
      'segments', E'Terrenos e áreas | Oportunidades para construção, investimento e desenvolvimento.
Casas e imóveis residenciais | Imóveis para diferentes momentos e necessidades.
Chácaras e sítios | Propriedades para moradia, lazer ou investimento.
Galpões e áreas industriais | Espaços destinados a empresas, operações e expansão de negócios.
Condomínios fechados | Imóveis e terrenos em empreendimentos residenciais.
Administração e locação | Gestão e intermediação de imóveis para proprietários e locatários.',
      'closing', E'Mais do que intermediar imóveis, construímos relações que atravessam gerações.

São décadas conhecendo Arujá, seus bairros, suas transformações e o mercado imobiliário da região.',
      'communication', 'Procuramos utilizar as mais diversas e avançadas formas de comunicação para oferecer nossos produtos e encontrar os melhores negócios para nossos clientes, com um padrão de qualidade e excelência especial para satisfazê-los e fidelizá-los.',
      'mission', 'Com atendimento personalizado, entender o cliente e ajudá-lo a realizar seus sonhos, deixando-os felizes e satisfeitos com seu imóvel, objetivando fidelizar o cliente e até nos tornar amigos fiéis.',
      'vision', 'Promover a alegria e satisfação dos clientes, aprimorando cada vez mais o atendimento personalizado, com total suporte até o final da negociação, e, com acompanhamento pós venda.',
      'values', 'Entender o cliente, para melhor atender, através de total dedicação, respeito, valorização, honestidade, transparência, clareza e dignidade. Além de todo o suporte após a compra ou locação de um imóvel.'
    ), true),

  ('seo', jsonb_build_object(
      'title',       'Vale do Sol Imóveis — Imóveis em Arujá desde 1975',
      'description', 'Casas, terrenos, condomínios, chácaras e imóveis comerciais em Arujá e região. Tradição em Arujá desde 1975. CRECI J-14.578.'
    ), true),

  ('analytics', jsonb_build_object(
      -- Preenchidos quando a imobiliária fornecer os IDs.
      'ga_measurement_id', '',
      'gsc_verification',  ''
    ), true)
on conflict (key) do nothing;
