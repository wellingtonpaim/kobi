/**
 * Regra de dependência da Clean Architecture (docs/engenharia.md, seção 2).
 * As camadas são identificadas pela pasta do pacote; um pacote novo precisa
 * entrar aqui para ter suas fronteiras verificadas.
 */
const layer = (name) => `^packages/${name}/`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment:
        'O domínio não depende de nada externo: nem outros pacotes, nem npm, nem APIs do Node.',
      severity: 'error',
      from: { path: layer('domain') },
      to: { pathNot: layer('domain') },
    },
    {
      name: 'application-depends-only-on-domain',
      comment: 'A aplicação conhece apenas o domínio e suas próprias portas.',
      severity: 'error',
      from: { path: layer('application') },
      to: { pathNot: [layer('application'), layer('domain')] },
    },
    {
      name: 'packages-do-not-know-the-apps',
      comment: 'Os apps são as bordas e composition roots; nenhum pacote depende deles.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'adapters-do-not-know-each-other',
      comment: 'Infraestrutura e apresentação (avatar) só se encontram no composition root.',
      severity: 'error',
      from: { path: layer('infrastructure') },
      to: { path: layer('avatar') },
    },
    {
      name: 'presentation-does-not-know-infrastructure',
      severity: 'error',
      from: { path: layer('avatar') },
      to: { path: layer('infrastructure') },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['/test/', '\\.test\\.ts$', '/dist/', 'vitest\\.config\\.ts$'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
    },
  },
};
