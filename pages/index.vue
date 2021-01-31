<template>
  <div class="container py-5">
    <b-alert v-if="error" variant="danger" show>Error: {{ error }}</b-alert>
    <span v-if="loading">loading...</span>
    <a v-if="!accessToken" :href="loginUrl" class="btn btn-primary">Login</a>
    <div v-if="accessToken && user && karma">
      <h5>Hey {{ user.name }}! You have {{ karma }} karma in the subreddit!</h5>
      <button v-if="ethAddress" class="btn btn-primary" @click="claim()">
        Claim Tokens
      </button>
      <button v-else class="btn btn-primary" @click="connect()">
        Connect Wallet
      </button>
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
  mounted() {
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
