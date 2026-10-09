/* eslint-disable no-undef */
// Runs the bundled action (dist/index.js) end to end against a mocked GitHub API and
// snapshots everything observable: exit code, log output, step outputs and API calls.
// A snapshot change means the action's behavior changed; review it deliberately.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const { startMockGitHub } = require('./mock-github')
const scenarios = require('./scenarios')

const bundle = path.join(__dirname, '..', 'dist', 'index.js')

function runAction(scenario, apiUrl) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-semver-bump-'))
    const eventPath = path.join(dir, 'event.json')
    const outputPath = path.join(dir, 'output')
    fs.writeFileSync(eventPath, JSON.stringify(scenario.event))
    fs.writeFileSync(outputPath, '')

    const env = {
        PATH: process.env.PATH,
        GITHUB_API_URL: apiUrl,
        GITHUB_REPOSITORY: 'o/r',
        GITHUB_EVENT_NAME: scenario.eventName,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_OUTPUT: outputPath,
        GITHUB_SHA: 'headsha',
        ...scenario.env,
    }
    Object.entries(scenario.inputs).forEach(([name, value]) => {
        env[`INPUT_${name.toUpperCase()}`] = value
    })

    return new Promise((resolve) => {
        const child = spawn(process.execPath, [bundle], { env })
        let stdout = ''
        child.stdout.on('data', (chunk) => { stdout += chunk })
        child.on('close', (exitCode) => {
            const outputs = fs.readFileSync(outputPath, 'utf8')
            fs.rmSync(dir, { recursive: true, force: true })
            resolve({
                exitCode: exitCode,
                // stack frames carry bundle line numbers, which change on every rebuild
                log: stdout.split('\n').filter((line) => !/^\s+at /.test(line)),
                outputs: outputs.replace(/ghadelimiter_[0-9a-f-]+/g, 'DELIMITER').split('\n'),
            })
        })
    })
}

test.each(scenarios.map((scenario) => [scenario.name, scenario]))('%s', async (name, scenario) => {
    const api = await startMockGitHub(scenario.fixture)
    try {
        const result = await runAction(scenario, api.url)
        expect({ ...result, requests: api.requests }).toMatchSnapshot()
    } finally {
        await api.close()
    }
})
