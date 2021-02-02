<template>
  <div
    class="container py-5 d-flex flex-column justify-content-center align-items-center"
  >
    <img src="header.png" style="max-width: 95%" />
    <h5 class="mb-5 text-center"></h5>
    <div class="bg-brand px-5 py-4 text-center">
      <div v-if="isEthereumBrowser">
        <b-alert v-if="showDataError" variant="danger" show>
          Error: Something went wrong when analyzing your reddit account.
        </b-alert>
        <div v-if="loadingData">
          Ok, let's see if you can claim something. One second please...
        </div>
        <div v-else-if="user">
          <h3 class="font-weight-bold">Hey {{ user.name }}!</h3>
          <div v-if="hasClaimed">
            It seems you've already claimed your airdrop. Did you add the token
            address to your wallet?<br /><br /><b>{{ fwsAddress }}</b>
          </div>
          <div v-else-if="ethAddress">
            <div v-if="claimAmount">
              <b-alert v-if="claimError" variant="danger" show>
                Something went wrong!<br />
                {{ claimError }}
              </b-alert>
              <div v-if="showClaimSuccess">
                Perfect! Look into your wallet now. You should have
                {{ claimAmount }} FWS now.<br />
                If you haven't added the token to your wallet yet, here's the
                address:<br /><b>{{ fwsAddress }}</b>
              </div>
              <div v-else>
                <div>Great! You can claim {{ claimAmount }} fun coupons.</div>
                <button
                  class="btn btn-brand btn-lg mt-3"
                  :disabled="requestingClaim || confirmingClaim"
                  @click="claim()"
                >
                  <span v-if="requestingClaim">sending request...</span>
                  <span v-else-if="confirmingClaim">
                    waiting for confirmation...
                  </span>
                  <span v-else>Ok, cool. Now give it to me!</span>
                </button>
                <div v-if="isMod" class="mt-3">
                  Oh and by the way... Each time a user claims tokens, a 5%
                  bonus will be automatically distributed to all moderators, who
                  already claimed theirs. ;)
                </div>
              </div>
            </div>
            <div v-else class="pt-3">
              Too bad. You are not eligable to claim anything. :(<br />
              Your account is either too new or you weren't involved enough.
              <span v-if="!subscription">
                It seems you didn't even join the subreddit.
              </span>
            </div>
          </div>
          <button v-else class="btn btn-brand btn-lg" @click="connect()">
            Connect Wallet
          </button>
        </div>
        <a v-else :href="loginUrl" class="btn btn-brand btn-lg">
          Ok, how much to I get?
        </a>
      </div>
      <a
        v-else
        href="https://metamask.io"
        target="_blank"
        class="btn btn-brand btn-lg"
      >
        Install MetaMask
      </a>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loginUrl: `https://www.reddit.com/api/v1/authorize.compact?client_id=${process.env.REDDIT_CLIENT_ID}&response_type=code&state=random&redirect_uri=${process.env.REDIRECT_URL}&duration=temporary&scope=mysubreddits,identity,history`,
      accessToken: null,
      showClaimSuccess: false,
      claimError: false,
      showDataError: false,
      loadingData: false,
      requestingClaim: false,
      confirmingClaim: false,
      ethAddress: null,
      user: null,
      karma: 0,
      subscription: null,
      totalSupply: 0,
      hasInteractedBeforeLaunch: false,
      hasClaimed: false,
    }
  },
  computed: {
    fwsAddress() {
      return process.env.FWS_ADDRESS
    },
    isEthereumBrowser() {
      return typeof window !== 'undefined' && window.ethereum
    },
    isMod() {
      if (this.subscription && this.subscription.data.user_is_moderator) {
        return true
      }
      return false
    },
    isSubscriber() {
      if (this.subscription && this.subscription.data.user_is_subscriber) {
        return true
      }
      return false
    },
    isBanned() {
      if (this.subscription && this.subscription.data.user_is_banned) {
        return true
      }
      return false
    },
    isNew() {
      if (this.user && this.user.created_utc > process.env.LAUNCH_DATE) {
        return true
      }
      return false
    },
    claimAmount() {
      let claimAmount = 0

      if (
        this.totalSupply / Math.pow(10, 18) < process.env.TIER0_MAX_SUPPLY ||
        this.hasInteractedBeforeLaunch
      ) {
        if (this.isSubscriber && !this.isNew) {
          claimAmount = process.env.TIER0_CLAIM_AMOUNT
          if (this.karma > process.env.SMALL_KARMA) {
            claimAmount = process.env.TIER1_CLAIM_AMOUNT
            if (this.karma > process.env.BIG_KARMA) {
              claimAmount = process.env.TIER2_CLAIM_AMOUNT
            }
          }
        }
      }

      return claimAmount
    },
  },
  mounted() {
    this.connect()
    const urlParams = new URLSearchParams(window.location.search)
    const error = urlParams.get('error')
    const code = urlParams.get('code')
    if (code && !error) {
      this.loadingData = true
      this.$axios
        .$post(process.env.API_URL + '/access-token', {
          code,
        })
        .then((accessToken) => {
          this.accessToken = accessToken
          this.$router.push('/')

          Promise.all([
            this.$axios.$post(process.env.API_URL + '/user', {
              accessToken: this.accessToken,
            }),
            this.$axios.$post(process.env.API_URL + '/karma', {
              accessToken: this.accessToken,
            }),
            this.$axios.$post(process.env.API_URL + '/subscription', {
              accessToken: this.accessToken,
            }),
            this.$axios.$post(
              process.env.API_URL + '/interacted-before-launch',
              {
                accessToken: this.accessToken,
              }
            ),
            this.$fws.methods.totalSupply().call(),
          ])
            .then((values) => {
              this.user = values[0]
              this.karma = values[1]
              this.subscription = values[2]
              this.hasInteractedBeforeLaunch = values[3]
              this.totalSupply = values[4]

              this.$fws.methods
                .hasClaimed(this.user.name)
                .call()
                .then((hasClaimed) => {
                  this.hasClaimed = true
                })
            })
            .catch(() => (this.showDataError = true))
            .finally(() => {
              setTimeout(() => {
                this.loadingData = false
              }, 3000)
            })
        })
        .catch(() => (this.loadingData = false))
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
        this.requestingClaim = true
        this.$axios
          .$post(process.env.API_URL + '/gasprice')
          .then((gasPrice) => {
            this.$fws.methods
              .claimRequest(this.user.name)
              .send({
                from: this.ethAddress,
                value: (
                  BigInt(gasPrice) * BigInt(process.env.CONFIRM_GAS)
                ).toString(),
              })
              .then((tx) => {
                this.requestingClaim = false
                this.confirmingClaim = true
                this.$axios
                  .$post(process.env.API_URL + '/confirm-claim', {
                    accessToken: this.accessToken,
                    requestId:
                      tx.events.ClaimRequestEvent.returnValues.requestId,
                  })
                  .then((tx) => (this.showClaimSuccess = true))
                  .catch((e) => (this.claimError = e))
                  .finally(() => (this.confirmingClaim = false))
              })
              .catch((e) => (this.requestingClaim = false))
          })
          .catch((e) => (this.requestingClaim = false))
      }
    },
  },
}
</script>
