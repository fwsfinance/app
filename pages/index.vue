<template>
  <div
    class="container py-5 d-flex flex-column justify-content-center align-items-center"
  >
    <img src="header.png" />
    <h5 class="mb-4 text-center"></h5>
    <div class="bg-brand px-5 py-4 text-center">
      <div v-if="isEthereumBrowser">
        <b-alert v-if="error" variant="danger" show>Error: {{ error }}</b-alert>
        <div v-if="loading">loading...</div>
        <a
          v-if="!loading && !accessToken"
          :href="loginUrl"
          class="btn btn-brand btn-lg"
          >Connect Reddit Account</a
        >
        <div v-if="accessToken && user && karma">
          <h5>Hey {{ user.name }}!</h5>
          <button
            v-if="ethAddress"
            class="btn btn-brand btn-lg"
            @click="claim()"
          >
            Claim Tokens
          </button>
          <button v-else class="btn btn-brand btn-lg" @click="connect()">
            Connect Wallet
          </button>
        </div>
      </div>
      <div v-else>
        <a
          href="https://metamask.io"
          target="_blank"
          class="btn btn-brand btn-lg"
          >Install MetaMask</a
        >
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loginUrl: `https://www.reddit.com/api/v1/authorize.compact?client_id=${process.env.REDDIT_CLIENT_ID}&response_type=code&state=random&redirect_uri=${process.env.REDIRECT_URL}&duration=temporary&scope=mysubreddits,identity,history`,
      accessToken: null,
      error: null,
      loading: false,
      user: null,
      karma: 0,
      ethAddress: null,
    }
  },
  computed: {
    isEthereumBrowser() {
      return typeof window !== 'undefined' && window.ethereum
    },
  },
  mounted() {
    this.connect()
    const urlParams = new URLSearchParams(window.location.search)
    const error = urlParams.get('error')
    const code = urlParams.get('code')
    if (code && !error) {
      this.loading = true
      this.$axios
        .$post(process.env.API_URL + '/reddit-access-token', {
          code,
        })
        .then((response) => {
          if (response.access_token) {
            this.accessToken = response.access_token
            this.$router.push('/')
            this.$axios
              .$post(process.env.API_URL + '/reddit-user', {
                accessToken: this.accessToken,
              })
              .then((response) => {
                this.user = response
                this.$axios
                  .$post(process.env.API_URL + '/reddit-karma', {
                    accessToken: this.accessToken,
                  })
                  .then((response) => {
                    response.data.forEach((subreddit) => {
                      if (subreddit.sr === 'finance') {
                        this.karma =
                          subreddit.comment_karma + subreddit.link_karma
                      }
                    })
                  })
              })
          } else {
            this.error = response.error
          }
        })
        .finally(() => (this.loading = false))
    }
  },
  methods: {
    connect() {
      this.$web3.eth.requestAccounts().then((accounts) => {
        this.ethAddress = accounts[0]
      })
    },
    claim() {
      if (this.user) {
        this.$web3.eth.getGasPrice((error, gasPrice) => {
          if (error) {
            console.log(error)
          } else {
            this.$fws.methods
              .claimRequest(this.user.name)
              .send({
                from: this.ethAddress,
                value: gasPrice * process.env.CONFIRM_GAS,
              })
              .then((tx) => {
                this.$axios
                  .$post(process.env.API_URL + '/confirm-claim', {
                    accessToken: this.accessToken,
                    requestId:
                      tx.events.ClaimRequestEvent.returnValues.requestId,
                  })
                  .then((tx) => {
                    console.log(tx)
                  })
              })
          }
        })
      }
    },
  },
}
</script>
