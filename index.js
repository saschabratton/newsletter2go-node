const axios = require('axios')

const VERSION = require('./package.json').version

const {
  NEWSLETTER2GO_AUTH_KEY,
  NEWSLETTER2GO_USERNAME,
  NEWSLETTER2GO_PASSWORD,
} = process.env

const TOKEN_GRANT_TYPE = 'https://nl2go.com/jwt'
const REFRESH_GRANT_TYPE = 'https://nl2go.com/jwt_refresh'

function Newsletter2Go(options) {
  this.accessToken = options.accessToken
  this.refreshToken = options.refreshToken
  this.authKey = options.authKey || NEWSLETTER2GO_AUTH_KEY
  this.username = options.username || NEWSLETTER2GO_USERNAME
  this.password = options.password || NEWSLETTER2GO_PASSWORD

  if (
    !this.accessToken && (!this.username || !this.password || !this.authKey)
  ) {
    throw new Error('Must provide access token or authorization credentials')
  }

  this.dispatch = axios.create({
    baseURL: 'https://api.newsletter2go.com',
    headers: {
      'User-Agent': `newsletters2go-node/v${VERSION}`,
    },
  })

  this.getToken = () => {
    if (this.accessToken) return Promise.resolve(this.accessToken)

    return this.dispatch.post('/oauth/v2/token', {
      username: this.username,
      password: this.password,
      grant_type: this.refreshToken ? REFRESH_GRANT_TYPE : TOKEN_GRANT_TYPE,
    }, {
      isTokenRequest: true,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.authKey}:`).toString('base64')}`,
      },
    })
      .then((res) => {
        if (!res.data.access_token) {
          return Promise.reject(new Error('Response missing access token'))
        }

        this.accessToken = res.data.access_token
        this.refreshToken = res.data.refresh_token

        return Promise.resolve(this.accessToken)
      })
  }

  this.dispatch.interceptors.request.use((config) => {
    if (config.isTokenRequest) return config

    return this.getToken()
      .then(accessToken => Promise.resolve(Object.assign({}, config, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })))
  })

  this.dispatch.interceptors.response.use(undefined, (err) => {
    if (err.response.data.error === 'invalid_grant') {
      this.accessToken = null
      return this.dispatch(err.config)
    }
    return Promise.reject(err)
  })

  this.attributes = {
    post: attribute => this.dispatch.post('/attributes', attribute),

    patch: (id, attribute) => this.dispatch.patch(`/attributes/${id}`, attribute),
  }

  this.companies = {
    get: () => this.dispatch.get('/companies'),

    patch: (id, company) => this.dispatch.post(`/companies/${id}`, company),
  }

  this.forms = {
    submit: (code, recipient) => this.dispatch.post(`/forms/submit/${code}`, recipient),
  }

  this.groups = {
    post: group => this.dispatch.post('/groups', group),

    delete: id => this.dispatch.delete(`/groups/${id}`),

    patch: (id, group) => this.dispatch.patch(`/groups/${id}`, group),
  }

  this.import = {
    info: {
      get: id => this.dispatch.get(`/import/${id}/info`),
    },
  }

  this.lists = {
    get: opts => this.dispatch.get('/lists', { params: opts }),

    post: list => this.dispatch.post('/lists', list),

    delete: id => this.dispatch.delete(`/lists/${id}`),

    patch: (id, list) => this.dispatch.patch(`/lists/${id}`, list),

    attributes: {
      get: (lid, opts) => this.dispatch.get(`/lists/${lid}/attributes`, { params: opts }),

      delete: (lid, id) => this.dispatch.delete(`/lists/${lid}/attributes/${id}`),
    },

    groups: {
      get: (lid, opts) => this.dispatch.get(`/lists/${lid}/groups`, { params: opts }),

      recipients: {
        delete: (lid, gid, id) => {
          if (typeof id !== 'object') {
            return this.dispatch.delete(`/lists/${lid}/groups/${gid}/recipients/${id}`)
          }

          return this.dispatch.delete(`/lists/${lid}/groups/${gid}/recipients`, id)
        },

        get: (lid, gid, opts) => this.dispatch.get(`/lists/${lid}/groups/${gid}/recipients`, { params: opts }),

        post: (lid, gid, id) => {
          if (typeof id !== 'object') {
            return this.dispatch.post(`/lists/${lid}/groups/${gid}/recipients/${id}`)
          }
          return this.dispatch.post(`/lists/${lid}/groups/${gid}/recipients`, id)
        },
      },
    },

    newsletters: {
      get: (lid, opts) => this.dispatch.get(`/lists/${lid}/newsletters`, { params: opts }),

      post: (lid, newsletter) => this.dispatch.post(`/lists/${lid}/newsletters`, newsletter),

      aggregations: {
        get: (lid, nid, opts) => this.dispatch.get(`/lists/${lid}/newsletters/${nid}/aggregations`, { params: opts }),
      },
    },

    recipients: {
      delete: (lid, id) => this.dispatch.delete(`/lists/${lid}/recipients/${id}`),

      patch: (lid, id, recipient) => {
        if (typeof id !== 'object') {
          return this.dispatch.patch(`/lists/${lid}/recipients/${id}`, recipient)
        }

        return this.dispatch.patch(`/lists/${lid}/recipients`, id)
      },

      get: (lid, opts) => this.dispatch.get(`/lists/${lid}/recipients`, { params: opts }),

      import: {
        init: (lid, file) => this.dispatch.post(`/lists/${lid}/recipients/import/init`, file),

        save: (lid, data) => this.dispatch.post(`/lists/${lid}/recipients/import/save`, data),
      },
    },
  }

  this.newsletters = {
    get: (id, opts) => this.dispatch.get(`/newsletters/${id}`, { params: opts }),

    patch: (id, newsletter) => this.dispatch.patch(`/newsletters/${id}`, newsletter),

    send: {
      post: (id, newsletter) => this.dispatch.post(`/newsletters/${id}/send`, newsletter),
    },
  }

  this.recipients = {
    post: recipients => this.dispatch.post('/recipients', recipients),
  }

  this.users = {
    get: opts => this.dispatch.get('/users', { params: opts }),

    patch: (id, user) => this.dispatch.patch(`/users/${id}`, user),
  }
}

module.exports = Newsletter2Go
