<template>
  <div
    class="container py-5 d-flex flex-column justify-content-center align-items-center"
  >
    <img src="header.png" style="max-width: 95%" />
    <h5 class="mb-5 text-center"></h5>
    <div class="bg-brand px-5 py-4 text-center">
      <div v-if="isEthereumBrowser">
        <div v-if="showDataError">
          <div class="mb-3">
            Something went wrong when fetching the data we need. :(
            <div v-if="wrongChain">
              Please connect your Metamask wallet with the Ethereum mainnet and
              then try again.
            </div>
          </div>
          <a :href="loginUrl" class="btn btn-brand btn-lg">Try again</a>
        </div>
        <div v-else-if="loadingData">
          Ok, let's see if you can claim something. One second please...
        </div>
        <div v-else-if="user">
          <h3 class="font-weight-bold">Hey {{ user.name }}!</h3>
          <div v-if="hasClaimed">
            It seems you've already claimed your airdrop. Did you add the token
            address to your wallet, so you can see your funds?<br /><br />
            <b>{{ fwsAddress }}</b>
          </div>
          <div v-else-if="isNew">
            Sorry! It seems you're account was created just recently.
            Unfortunately we can't issue tokens for accounts created after this
            project launched.
          </div>
          <div v-else-if="ethAddress">
            <div v-if="claimAmount">
              <div v-if="claimError" class="mb-2">
                Shhoooot! Something went wrong that really should not!<br />
                {{ claimError }}<br />
                We are sorry. :'(
              </div>
              <div v-if="showClaimSuccess">
                <br />Perfect! You have {{ claimAmount }} FWS now.<br />If you
                haven't done so yet, learn
                <a
                  href="https://metamask.zendesk.com/hc/en-us/articles/360015489031-How-to-View-See-Your-Tokens-and-Custom-Tokens-in-Metamask"
                  >here</a
                >
                how to add a new token's balance to your Metamask wallet.<br />
                <br />
                Token Address:<br /><b>{{ fwsAddress }}</b>
              </div>
              <div v-else>
                <div>
                  <b>
                    Great! You can claim {{ claimAmount }} FWS, or "fun coupons"
                    as we call them.
                  </b>
                </div>
                <div>(Current Supply: {{ totalSupplyFormatted }})</div>
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
                  By the way... Looks like you are a <b>moderator</b>. Each time
                  a user claims tokens, 5% of them are distributed to the
                  moderators. But only those who already claimed their own
                  airdrop. So just claim your tokens now and watch your balance
                  grow even more over time.
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
    <footer class="my-5">
      <a href="https://github.com/fwsfinance" target="_blank" class="mx-2">
        <font-awesome-icon :icon="['fab', 'github']" class="fa-2x" />
      </a>
      <a href="https://github.com/fwsfinance" target="_blank" class="mx-2">
        <font-awesome-icon :icon="['fab', 'twitter']" class="fa-2x" />
      </a>
    </footer>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loginUrl: `https://www.reddit.com/api/v1/authorize.compact?client_id=${process.env.REDDIT_CLIENT_ID}&response_type=code&state=random&redirect_uri=${process.env.REDIRECT_URL}&duration=temporary&scope=mysubreddits,identity,history`,
      accessToken: null,
      ethAddress: null,
      ethChainID: null,
      showClaimSuccess: false,
      claimError: false,
      showDataError: false,
      loadingData: false,
      requestingClaim: false,
      confirmingClaim: false,
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
    wrongChain() {
      return this.ethChainID !== process.env.ETH_CHAIN_ID
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
        BigInt(this.totalSupply) < BigInt(process.env.TIER0_MAX_SUPPLY) ||
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
    totalSupplyFormatted() {
      return new Intl.NumberFormat().format(
        this.$web3.utils.fromWei(this.totalSupply, 'ether')
      )
    },
  },
  mounted() {
    this.connect()
    this.listenForAccountORChainChange()
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
                  this.hasClaimed = hasClaimed
                })
            })
            .catch(() => {
              this.showDataError = true
            })
            .finally(() => {
              setTimeout(() => {
                this.loadingData = false
              }, 2000)
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
      this.$web3.eth.getChainId().then((id) => {
        this.ethChainID = id
      })
    },
    listenForAccountORChainChange() {
      window.ethereum.on('accountsChanged', () => {
        this.connect()
      })

      window.ethereum.on('chainChanged', () => {
        this.connect()
      })
    },
    claim() {
      if (this.user) {
        this.requestingClaim = true
        this.$fws.methods
          .oracleFee()
          .call()
          .then((fee) => {
            this.$fws.methods
              .claimRequest(this.user.name)
              .send({
                from: this.ethAddress,
                value: fee,
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
