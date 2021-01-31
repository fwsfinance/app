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

app.post('/reddit-access-token', (req, res) => {
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
      res.json(response.data)
    })
})

app.post('/reddit-karma', (req, res) => {
  const accessToken = req.body.accessToken
  axios
    .get('https://oauth.reddit.com/api/v1/me/karma', {
      headers: {
        Authorization: 'Bearer ' + accessToken,
      },
    })
    .then((response) => {
      res.json(response.data)
    })
    .catch((e) => {
      res.status(500).json(e)
    })
})

app.post('/reddit-user', (req, res) => {
  const accessToken = req.body.accessToken
  axios
    .get('https://oauth.reddit.com/api/v1/me', {
      headers: {
        Authorization: 'Bearer ' + accessToken,
      },
    })
    .then((response) => {
      res.json(response.data)
    })
    .catch((e) => {
      res.status(500).json(e)
    })
})

app.post('/reddit-comments', (req, res) => {
  const accessToken = req.body.accessToken
  getUserComments(accessToken)
    .then((comments) => {
      let commentBeforeDate
      comments.forEach((comment) => {
        if (
          comment.data.subreddit === process.env.SUBREDDIT &&
          comment.data.created_utc < process.env.LAUNCH_DATE
        ) {
          commentBeforeDate = comment
        }
      })
      if (commentBeforeDate) {
        res.json(true)
      } else {
        res.status(403).json('forbidden')
      }
    })
    .catch((e) => {
      res.status(500).json(e)
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
        axios
          .get('https://oauth.reddit.com/api/v1/me', {
            headers: {
              Authorization: 'Bearer ' + accessToken,
            },
          })
          .then((response) => {
            const user = response.data
            if (user.name === claim.redditUser) {
              axios
                .get('https://oauth.reddit.com/api/v1/me/karma', {
                  headers: {
                    Authorization: 'Bearer ' + accessToken,
                  },
                })
                .then((response) => {
                  let karma
                  response.data.data.forEach((subreddit) => {
                    if (subreddit.sr === process.env.SUBREDDIT) {
                      karma = subreddit.comment_karma + subreddit.link_karma
                    }
                  })
                  if (karma >= process.env.SMALL_KARMA) {
                    let claimAmount = Number(process.env.SMALL_CLAIM)
                    if (karma >= process.env.BIG_KARMA) {
                      claimAmount = Number(process.env.BIG_CLAIM)
                    }
                    getUserComments(accessToken).then((comments) => {
                      let commentBeforeDate
                      comments.forEach((comment) => {
                        if (
                          comment.data.subreddit === process.env.SUBREDDIT &&
                          comment.data.created_utc < process.env.LAUNCH_DATE
                        ) {
                          commentBeforeDate = comment
                        }
                      })
                      if (commentBeforeDate) {
                        fws.methods
                          .claimConfirm(
                            requestId,
                            (claimAmount * Math.pow(10, 18)).toString()
                          )
                          .send({ from: process.env.ORACLE_ADDRESS })
                          .then((tx) => {
                            res.json(tx)
                          })
                          .catch((e) => {
                            res.status(500).json(e)
                          })
                      } else {
                        res
                          .status(403)
                          .json('Forbidden: User was created too recently.')
                      }
                    })
                  } else {
                    res.status(403).json('Forbidden: Not enough karma.')
                  }
                })
                .catch((e) => {
                  res.status(501).json(e)
                })
            } else {
              res.status(403).json('Forbidden: Wrong user.')
            }
          })
          .catch((e) => {
            res.status(502).json(e)
          })
      } else {
        res.status(403).json('Forbidden: Already claimed.')
      }
    })
    .catch((e) => {
      res.status(503).json(e)
    })
})

const getUserComments = (accessToken, after, result = []) => {
  return axios
    .get('https://oauth.reddit.com/user/mktatreddit/comments?after=' + after, {
      headers: {
        Authorization: 'bearer ' + accessToken,
      },
    })
    .then((res) => {
      result.push(...res.data.data.children)
      if (res.data.data.after) {
        return getUserComments(accessToken, res.data.data.after, result)
      } else {
        return result
      }
    })
    .catch((e) => console.log(e))
}

module.exports = {
  path: '/api',
  handler: app,
}
