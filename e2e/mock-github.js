const http = require('http')

// A minimal in-process stand-in for the GitHub REST API endpoints used by the action.
// Every request is recorded so tests can assert exactly what the action asked for.
function startMockGitHub(fixture = {}) {
    const requests = []
    let server

    const routes = [
        ['GET', /^\/repos\/o\/r\/pulls\/(\d+)$/, (m) => {
            const pr = (fixture.prs || {})[m[1]]
            return pr ? [200, pr] : [404, { message: 'Not Found' }]
        }],
        ['GET', /^\/repos\/o\/r\/git\/matching-refs\//, () => [200, (fixture.tags || []).map(
            ([name, type, sha]) => ({ ref: `refs/tags/${name}`, object: { type, sha } }),
        )]],
        ['GET', /^\/search\/issues$/, () => {
            const items = fixture.search || []
            return [200, { total_count: items.length, items: items }]
        }],
        ['GET', /^\/repos\/o\/r\/commits$/, (m, url) => {
            const pages = fixture.commitPages || [[]]
            const page = Number(url.searchParams.get('page') || 1)
            const headers = {}
            if (page < pages.length) {
                const next = `http://127.0.0.1:${server.address().port}/repos/o/r/commits?sha=${url.searchParams.get('sha')}&page=${page + 1}`
                headers.link = `<${next}>; rel="next"`
            }
            return [200, (pages[page - 1] || []).map((sha) => ({ sha })), headers]
        }],
        ['GET', /^\/repos\/o\/r\/git\/tags\/(\w+)$/, (m) => [200, { object: { sha: (fixture.tagObjects || {})[m[1]] } }]],
        ['POST', /^\/repos\/o\/r\/git\/tags$/, () => (fixture.createTagStatus
            ? [fixture.createTagStatus, { message: 'Resource not accessible by integration' }]
            : [201, { sha: 'newtagobj' }])],
        ['POST', /^\/repos\/o\/r\/git\/refs$/, () => [201, { ref: 'ok' }]],
    ]

    server = http.createServer((req, res) => {
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
            const url = new URL(req.url, 'http://localhost')
            const path = decodeURIComponent(url.pathname)
            requests.push({
                method: req.method,
                path: path + decodeURIComponent(url.search),
                auth: req.headers.authorization,
                body: body ? JSON.parse(body) : undefined,
            })

            let response = [500, { message: `unmocked ${req.method} ${path}` }]
            const route = routes.find(([method, re]) => method === req.method && re.test(path))
            if (route) {
                response = route[2](path.match(route[1]), url)
            }
            const [status, payload, headers = {}] = response
            res.writeHead(status, { 'content-type': 'application/json', ...headers })
            res.end(JSON.stringify(payload))
        })
    })

    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve({
            url: `http://127.0.0.1:${server.address().port}`,
            requests: requests,
            close: () => new Promise((done) => { server.close(done) }),
        }))
    })
}

module.exports = { startMockGitHub }
