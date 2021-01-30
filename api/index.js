import querystring from 'querystring'
import axios from 'axios'
import express from 'express'
require('dotenv').config()

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

module.exports = {
  path: '/api',
  handler: app,
}
