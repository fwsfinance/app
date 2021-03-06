import fs from 'fs'

export default {
  // Disable server-side rendering: https://go.nuxtjs.dev/ssr-mode
  ssr: false,

  // Target: https://go.nuxtjs.dev/config-target
  target: 'server',

  serverMiddleware: ['~/api/index'],

  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    title: 'Fuck Wall Street',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: '' },
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      {
        rel: 'stylesheet',
        type: 'text/css',
        href:
          'https://fonts.googleapis.com/css2?family=Montserrat:wght@100;200;300;400;500;600;700;800;900&display=swap',
      },
    ],
  },

  loading: {
    color: '#f3ad2a',
    height: '10px',
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: ['@/assets/main.sass'],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: ['@/plugins/web3'],

  // Auto import components: https://go.nuxtjs.dev/config-components
  components: true,

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
    // https://go.nuxtjs.dev/eslint
    '@nuxtjs/eslint-module',
    [
      '@nuxtjs/dotenv',
      {
        path: './',
        only: [
          'API_URL',
          'REDIRECT_URL',
          'REDDIT_CLIENT_ID',
          'FWS_ADDRESS',
          'CONFIRM_GAS',
          'SUBREDDIT',
          'SMALL_KARMA',
          'BIG_KARMA',
          'TIER0_MAX_SUPPLY',
          'TIER0_CLAIM_AMOUNT',
          'TIER1_CLAIM_AMOUNT',
          'TIER2_CLAIM_AMOUNT',
        ],
      },
    ],
    '@nuxtjs/fontawesome',
  ],

  fontawesome: {
    icons: {
      brands: ['faGithub', 'faTwitter'],
      solid: ['faCircleNotch', 'faChevronLeft'],
    },
  },

  env: {
    FWS_ABI: JSON.parse(fs.readFileSync('./FuckWallStreet.json').toString())
      .abi,
  },

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    // https://go.nuxtjs.dev/bootstrap
    'bootstrap-vue/nuxt',
    // https://go.nuxtjs.dev/axios
    '@nuxtjs/axios',
    // https://go.nuxtjs.dev/pwa
    '@nuxtjs/pwa',
  ],

  // Axios module configuration: https://go.nuxtjs.dev/config-axios
  axios: {},

  // PWA module configuration: https://go.nuxtjs.dev/pwa
  pwa: {
    manifest: {
      lang: 'en',
    },
  },

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {},
}
