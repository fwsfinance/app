import querystring from 'querystring'
import fs from 'fs'
import axios from 'axios'
import express from 'express'
import Web3 from 'web3'
import HDWalletProvider from '@truffle/hdwallet-provider'
require('dotenv').config()

const mnemonic = fs.readFileSync('.mnemonic').toString().trim()
const walletProvider = new HDWalletProvider(mnemonic, process.env.ETH_NODE)
const web3wallet = new Web3(walletProvider)
const fws = new web3wallet.eth.Contract(
  require('./../FuckWallStreet.json').abi,
  process.env.FWS_ADDRESS
)

const app = express()

app.use(express.json())

// get reddit oauth access token from code
app.post('/access-token', (req, res) => {
  const code = req.body.code
  axios
    .post(
      'https://www.reddit.com/api/v1/access_token',
      querystring.stringify({
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.REDIRECT_URL,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(
              process.env.REDDIT_CLIENT_ID +
                ':' +
                process.env.REDDIT_CLIENT_SECRET
            ).toString('base64'),
        },
      }
    )
    .then((response) => {
      res.json(response.data.access_token)
    })
    .catch((e) =>
      res.status(500).json(JSON.stringify(e, Object.getOwnPropertyNames(e)))
    )
})

// get current gas price
app.post('/gasprice', (req, res) => {
  axios
    .get(
      'https://ethgasstation.info/api/ethgasAPI.json?api-key=' +
        process.env.GAS_STATION_API_KEY
    )
    .then((response) => {
      res.json((response.data.average / 10) * 1000000000)
    })
    .catch((e) => {
      res.status(500).json(JSON.stringify(e, Object.getOwnPropertyNames(e)))
    })
})

// get users karma for the subreddit
app.post('/karma', (req, res) => {
  const accessToken = req.body.accessToken
  getKarma(accessToken)
    .then((karma) => {
      res.json(karma)
    })
    .catch((e) => {
      res.status(500).json(JSON.stringify(e, Object.getOwnPropertyNames(e)))
    })
})

// get reddit user
app.post('/user', (req, res) => {
  const accessToken = req.body.accessToken
  getUser(accessToken)
    .then((user) => {
      res.json(user)
    })
    .catch((e) => {
      res.status(500).json(JSON.stringify(e, Object.getOwnPropertyNames(e)))
    })
})

// get reddit users subscription to the subreddit
app.post('/subscription', (req, res) => {
  const accessToken = req.body.accessToken
  getSubscriptions(accessToken)
    .then((subscriptions) => {
      res.json(getSubscription(subscriptions))
    })
    .catch((e) => {
      res.status(500).json(JSON.stringify(e, Object.getOwnPropertyNames(e)))
    })
})

// get reddit users subscription to the subreddit
app.post('/interacted-before-launch', (req, res) => {
  const accessToken = req.body.accessToken
  getUser(accessToken)
    .then((user) => {
      Promise.all([
        getComments(accessToken, user.name),
        getUpvotes(accessToken, user.name),
      ])
        .then((values) => {
          res.json(
            getInteractedBeforeLaunch(
              values[0],
              values[1],
              process.env.LAUNCH_DATE
            )
          )
        })
        .catch((e) => {
          res.status(500).json(JSON.stringify(e, Object.getOwnPropertyNames(e)))
        })
    })
    .catch((e) => {
      res.status(500).json(JSON.stringify(e, Object.getOwnPropertyNames(e)))
    })
})

app.post('/confirm-claim', (req, res) => {
  const accessToken = req.body.accessToken
  const requestId = req.body.requestId
  fws.methods
    .claims(requestId)
    .call()
    .then((claim) => {
      if (!claim.confirmed) {
        getUser(accessToken)
          .then((user) => {
            Promise.all([
              getKarma(accessToken),
              getComments(accessToken, user.name),
              getUpvotes(accessToken, user.name),
              getSubscriptions(accessToken),
              fws.methods.totalSupply().call(),
            ]).then((values) => {
              const karma = values[0]
              const comments = values[1]
              const upvotes = values[2]
              const subscriptions = values[3]
              const totalSupply = values[4]
              const hasInteractedBeforeLaunch = getInteractedBeforeLaunch(
                comments,
                upvotes,
                process.env.LAUNCH_DATE
              )
              const subscription = getSubscription(subscriptions)
              const isSubscriber = subscription.data.user_is_subscriber
              const isMod = subscription.data.user_is_moderator
              const isBanned = subscription.data.user_is_banned

              if (user.name === claim.redditUser) {
                if (
                  user.created_utc < process.env.LAUNCH_DATE &&
                  isSubscriber &&
                  !isBanned
                ) {
                  if (
                    totalSupply / Math.pow(10, 18) <
                      process.env.TIER0_MAX_SUPPLY ||
                    hasInteractedBeforeLaunch
                  ) {
                    let tier = 0
                    if (karma >= process.env.SMALL_KARMA) {
                      tier = 1
                      if (karma >= process.env.BIG_KARMA) {
                        tier = 2
                      }
                    }

                    fws.methods
                      .claimConfirm(requestId, tier, isMod)
                      .send({ from: process.env.ORACLE_ADDRESS })
                      .then((tx) => {
                        res.json(tx)
                      })
                      .catch((e) => {
                        res
                          .status(500)
                          .json(
                            JSON.stringify(e, Object.getOwnPropertyNames(e))
                          )
                      })
                  } else {
                    res
                      .status(403)
                      .json(
                        'Forbidden: Tier0 supply exceeded or no prior interaction.'
                      )
                  }
                } else {
                  res
                    .status(403)
                    .json(
                      'Forbidden: User was created too recently or is banned or not a subscriber.'
                    )
                }
              } else {
                res.status(403).json('Forbidden: Wrong user.')
              }
            })
          })
          .catch((e) => {
            res
              .status(500)
              .json(JSON.stringify(e, Object.getOwnPropertyNames(e)))
          })
      } else {
        res.status(403).json('Forbidden: Claim already confirmed.')
      }
    })
})

const getSubscriptions = (accessToken, after, result = []) => {
  return axios
    .get('https://oauth.reddit.com/subreddits/mine/subscriber?after=' + after, {
      headers: {
        Authorization: 'bearer ' + accessToken,
      },
    })
    .then((res) => {
      result.push(...res.data.data.children)
      if (res.data.data.after) {
        return getSubscriptions(accessToken, res.data.data.after, result)
      } else {
        return result
      }
    })
    .catch((e) => console.log(e))
}

const getSubscription = (subscriptions) => {
  let subscription
  subscriptions.forEach((sub) => {
    if (sub.data.display_name === process.env.SUBREDDIT) {
      subscription = sub
    }
  })
  return subscription
}

const getComments = (accessToken, username, after, result = []) => {
  return axios
    .get(
      'https://oauth.reddit.com/user/' + username + '/comments?after=' + after,
      {
        headers: {
          Authorization: 'bearer ' + accessToken,
        },
      }
    )
    .then((res) => {
      result.push(...res.data.data.children)
      if (res.data.data.after) {
        return getComments(accessToken, username, res.data.data.after, result)
      } else {
        return result
      }
    })
    .catch((e) => console.log(e))
}

const getUpvotes = (accessToken, username, after, result = []) => {
  return axios
    .get(
      'https://oauth.reddit.com/user/' + username + '/upvoted?after=' + after,
      {
        headers: {
          Authorization: 'bearer ' + accessToken,
        },
      }
    )
    .then((res) => {
      result.push(...res.data.data.children)
      if (res.data.data.after) {
        return getUpvotes(accessToken, username, res.data.data.after, result)
      } else {
        return result
      }
    })
    .catch((e) => console.log(e))
}

const getInteractedBeforeLaunch = (comments, upvotes, timestamp) => {
  let interactedBeforeDate
  comments.forEach((comment) => {
    if (
      comment.data.subreddit === process.env.SUBREDDIT &&
      comment.data.created_utc < process.env.LAUNCH_DATE
    ) {
      interactedBeforeDate = comment
    }
  })
  upvotes.forEach((upvote) => {
    if (
      upvote.data.subreddit === process.env.SUBREDDIT &&
      upvote.data.created_utc < process.env.LAUNCH_DATE
    ) {
      interactedBeforeDate = upvote
    }
  })

  return !!interactedBeforeDate
}

const getKarma = (accessToken) => {
  return axios
    .get('https://oauth.reddit.com/api/v1/me/karma', {
      headers: {
        Authorization: 'Bearer ' + accessToken,
      },
    })
    .then((response) => {
      let karma = 0
      response.data.data.forEach((subreddit) => {
        if (subreddit.sr === process.env.SUBREDDIT) {
          karma = subreddit.comment_karma + subreddit.link_karma
        }
      })
      return karma
    })
    .catch((e) => console.log(e))
}

const getUser = (accessToken) => {
  return axios
    .get('https://oauth.reddit.com/api/v1/me', {
      headers: {
        Authorization: 'Bearer ' + accessToken,
      },
    })
    .then((response) => {
      return response.data
    })
    .catch((e) => console.log(e))
}

module.exports = {
  path: '/api',
  handler: app,
}
