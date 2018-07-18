const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();

app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.get('/callback', (req, res) => {
  exchangeCodeForAccessToken()
  .then(exchangeAccessTokenForUserInfo)
  .then(fetchAuth0AccessToken)
  .then(fetchGithubAccessToken)
  .then(setGitTokenToSession)
  .catch(err => {
    console.log('Error', err);
    res.status(500).json({ message: "Error on the Server"});
  });

  function exchangeCodeForAccessToken () {
    const payload = {
      client_id: process.env.REACT_APP_AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      code: req.query.code,
      grant_type: 'authorization_code',
      redirect_uri: `http://${req.headers.host}/callback`
    }

    return axios.post(`https://${process.env.REACT_APP_AUTH0_DOMAIN}/oauth/token`, payload)
  }

  function exchangeAccessTokenForUserInfo (accessTokenResponse) {
    console.log(accessTokenResponse.data.access_token)
    const accessToken = accessTokenResponse.data.access_token;
    
    return axios.get(`https://${process.env.REACT_APP_AUTH0_DOMAIN}/userinfo?access_token=${accessToken}`);

  }

  function fetchAuth0AccessToken(userInfoResponse) {
    console.log(userInfoResponse.data)
    req.session.user = userInfoResponse.data
    const payload = {
      grant_type: 'client_credentials',
      client_id: process.env.AUTH0_API_CLIENT_ID,
      client_secret: process.env.AUTH0_API_CLIENT_SECRET,
      audience: `https://${process.env.REACT_APP_AUTH0_DOMAIN}/api/v2/`
    }

    return axios.post(`https://${process.env.REACT_APP_AUTH0_DOMAIN}/oauth/token`, payload)

  }

  function fetchGithubAccessToken (auth0AccessTokenResponse) {
    const options = {
      headers: {
        authorization: `Bearer ${auth0AccessTokenResponse.data.access_token}`
      }
    };

    return axios.get(`https://${process.env.REACT_APP_AUTH0_DOMAIN}/api/v2/users/${req.session.user.sub}`, options)

  }

  function setGitTokenToSession(githubAccessTokenResponse) {
    const githubIdentity = githubAccessTokenResponse.data.identities[0];
    req.session.githubAccessToken = githubIdentity.access_token;
    res.redirect('/');
  }
});


app.put('/api/star', (req, res) => {
  const { gitUser, gitRepo } = req.query
  axios.put(`https://api.github.com/user/starred/${gitUser}/${gitRepo}?access_token=${req.session.githubAccessToken}`).then(() => {
    res.end();
  }).catch(err => {
    res.status(500).json({ message: 'Error on the server'})
    console.log('Error on axios.put api/star', err);
  });
});

app.delete('/api/star', (req, res) => {
  const { gitUser, gitRepo } = req.query
  axios.delete(`https://api.github.com/user/starred/${gitUser}/${gitRepo}?access_token=${req.session.githubAccessToken}`).then(() => {
    res.end();
  }).catch(err => {
    res.status(500).json({ message: 'Error on the server'})
    console.log('Error on the axios.delete api/star', err);
  });
});






app.get('/api/user-data', (req, res) => {
  res.status(200).json(req.session.user)
})

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.send('logged out');
})

const port = 4000;
app.listen(port, () => { console.log(`Server listening on port ${port}`); });
