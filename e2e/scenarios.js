// End-to-end scenarios for the bundled action. Each one describes the workflow event,
// the action inputs and the state of the (mocked) GitHub repository.

const pr = (number, labels, body) => ({
    number: number,
    labels: labels.map((name) => ({ name })),
    body: body,
})
const prEvent = (number) => ({ pull_request: { number } })
const pushEvent = (message) => ({ head_commit: { message } })

const NOTES = 'Some intro\n\n### RELEASE NOTES\n- fixed a thing\n- added a thing\n'
const base = {
    'repo-token': 'tok123',
    'release-notes-prefix': '### RELEASE NOTES',
    'require-release-notes': 'true',
    'with-v': 'true',
}

const mixedTags = [
    ['v1.2.3', 'commit', 'c1'],
    ['v1.10.0', 'commit', 'c2'],
    ['1.9.9', 'commit', 'c3'],
    ['not-a-version', 'commit', 'c4'],
    ['v2.0.0-beta.1', 'commit', 'c5'],
    ['latest', 'commit', 'c6'],
    ['v1', 'commit', 'c7'],
]
const looseTags = [
    ['v01.02.03', 'commit', 'l1'],
    ['=v1.2.4', 'commit', 'l2'],
    ['1.2.3.4', 'commit', 'l3'],
    ['v1.2', 'commit', 'l4'],
    ['1.2.5+build.7', 'commit', 'l5'],
    ['V1.2.6', 'commit', 'l6'],
    ['release-9.9.9', 'commit', 'l7'],
    ['v1.2.7-rc.1', 'commit', 'l8'],
    ['1.2.7-rc.1', 'commit', 'l9'],
    ['v1.2.8-', 'commit', 'l10'],
]
const branchFixture = {
    tags: [
        ['v3.0.0', 'commit', 'off-branch'],
        ['v2.5.0', 'tag', 'tagobjA'],
        ['v2.4.0', 'commit', 'b2'],
        ['v2.6.0', 'tag', 'tagobjB'],
    ],
    commitPages: [['b1', 'b2'], ['b3', 'b4'], ['b5']],
    tagObjects: { tagobjA: 'b4', tagobjB: 'not-on-branch' },
}

const validate = (name, inputs, fixture, env) => ({
    name: `validate: ${name}`, eventName: 'pull_request', event: prEvent(7), inputs: { mode: 'validate', ...inputs }, fixture: fixture, env: env,
})
const bump = (name, message, inputs, fixture, env) => ({
    name: `bump: ${name}`, eventName: 'push', event: pushEvent(message), inputs: { mode: 'bump', ...inputs }, fixture: fixture, env: env,
})

module.exports = [
    validate('minor', base, { prs: { 7: pr(7, ['minor release'], NOTES) }, tags: mixedTags }),
    validate('major with unrelated label', base, { prs: { 7: pr(7, ['major release', 'docs'], NOTES) }, tags: mixedTags }),
    validate('patch', base, { prs: { 7: pr(7, ['patch release'], NOTES) }, tags: mixedTags }),
    validate('no release label', base, { prs: { 7: pr(7, ['docs'], NOTES) }, tags: mixedTags }),
    validate('two release labels', base, { prs: { 7: pr(7, ['minor release', 'patch release'], NOTES) } }),
    validate('release and noop label', { ...base, 'noop-labels': 'no release' }, { prs: { 7: pr(7, ['minor release', 'no release'], NOTES) } }),
    validate('noop label only', { ...base, 'noop-labels': 'skip\nno release' }, { prs: { 7: pr(7, ['no release'], '') }, tags: mixedTags }),
    validate('noop label only, with notes', { ...base, 'noop-labels': 'no release' }, { prs: { 7: pr(7, ['no release'], NOTES) }, tags: mixedTags }),
    validate('missing required notes', base, { prs: { 7: pr(7, ['minor release'], 'no prefix here') } }),
    validate('null body, notes optional', { 'repo-token': 'tok123' }, { prs: { 7: pr(7, ['patch release'], null) }, tags: mixedTags }),
    validate('whole body as notes', { 'repo-token': 'tok123' }, { prs: { 7: pr(7, ['patch release'], '  line1\r\nline2\r\n\r\n') }, tags: mixedTags }),
    validate('prefix and suffix with CRLF', { ...base, 'release-notes-suffix': '^---$' }, { prs: { 7: pr(7, ['minor release'], 'x\r\n### RELEASE NOTES\r\na\r\nb\r\n---\r\nfooter') }, tags: mixedTags }),
    validate('suffix only', { 'repo-token': 'tok123', 'release-notes-suffix': 'END' }, { prs: { 7: pr(7, ['minor release'], 'a\nb\nEND\nc') }, tags: mixedTags }),
    validate('custom labels, no tags, no v', {
        'repo-token': 'tok123', 'major-label': 'breaking', 'minor-label': 'feature', 'patch-label': 'fix',
    }, { prs: { 7: pr(7, ['feature'], 'n') }, tags: [] }),
    validate('loose and odd tags', base, { prs: { 7: pr(7, ['patch release'], NOTES) }, tags: looseTags }),
    validate('prerelease current, minor', base, { prs: { 7: pr(7, ['minor release'], NOTES) }, tags: [['v2.0.0-beta.1', 'commit', 'p'], ['v1.4.0', 'commit', 'q']] }),
    validate('prerelease current, patch', base, { prs: { 7: pr(7, ['patch release'], NOTES) }, tags: [['v1.2.3-rc.2', 'commit', 'p']] }),
    validate('prerelease current, major', base, { prs: { 7: pr(7, ['major release'], NOTES) }, tags: [['v1.0.0-alpha', 'commit', 'p'], ['2.0.0-0', 'commit', 'q']] }),
    validate('duplicate v and non-v tags', base, { prs: { 7: pr(7, ['minor release'], NOTES) }, tags: [['v1.2.3', 'commit', 'a'], ['1.2.3', 'commit', 'b']] }),
    validate('base-branch with paginated commits', { ...base, 'base-branch': 'true' }, { prs: { 7: pr(7, ['minor release'], NOTES) }, ...branchFixture }, { GITHUB_BASE_REF: 'main' }),
    validate('base-branch, no tag on branch', { ...base, 'base-branch': 'true' }, { prs: { 7: pr(7, ['minor release'], NOTES) }, tags: [['v9.0.0', 'commit', 'zz']], commitPages: [['b1']] }, { GITHUB_BASE_REF: 'main' }),
    validate('mode is case-insensitive', { ...base, mode: 'VALIDATE' }, { prs: { 7: pr(7, ['patch release'], NOTES) }, tags: mixedTags }),
    { ...validate('PR not found', base, {}), event: prEvent(99) },
    { ...validate('wrong event', base, {}), eventName: 'push', event: pushEvent('x') },
    { ...validate('invalid mode', { ...base, mode: 'release' }, {}) },
    { ...validate('missing token', {}, {}) },

    bump('merge commit, major', 'Merge pull request #12 from me/branch\n\ntitle', base, { prs: { 12: pr(12, ['major release'], NOTES) }, tags: mixedTags }),
    bump('squash commit, patch, no v', 'Fix bug (#13)\n\n* details', { ...base, 'with-v': 'false' }, { prs: { 13: pr(13, ['patch release'], NOTES) }, tags: mixedTags }),
    bump('rebase merge, PR found via search', 'plain commit', base, { search: [pr(14, ['minor release'], NOTES)], tags: mixedTags }),
    bump('no PR for commit (direct push or first commit)', 'plain commit', base, { search: [], tags: mixedTags }),
    bump('noop label', 'Merge pull request #15 from me/b', { ...base, 'noop-labels': 'no release' }, { prs: { 15: pr(15, ['no release'], '') }, tags: mixedTags }),
    bump('missing required notes', 'x (#16)', base, { prs: { 16: pr(16, ['minor release'], 'nothing') }, tags: mixedTags }),
    bump('no release label', 'x (#17)', base, { prs: { 17: pr(17, [], NOTES) }, tags: mixedTags }),
    bump('PR not found', 'x (#18)', base, {}),
    bump('tag creation forbidden', 'x (#22)', base, { prs: { 22: pr(22, ['minor release'], NOTES) }, tags: mixedTags, createTagStatus: 403 }),
    bump('first release, no tags', 'x (#19)', base, { prs: { 19: pr(19, ['minor release'], NOTES) }, tags: [] }),
    bump('base-branch from GITHUB_REF', 'x (#20)', { ...base, 'base-branch': 'true' }, { prs: { 20: pr(20, ['patch release'], NOTES) }, ...branchFixture }, { GITHUB_REF: 'refs/heads/main' }),
    bump('prerelease current, patch', 'x (#21)', base, { prs: { 21: pr(21, ['patch release'], NOTES) }, tags: [['v1.2.3-rc.2', 'commit', 'p']] }),
    { ...bump('wrong event', '', base, {}), eventName: 'pull_request', event: prEvent(7) },
    { ...bump('push without head commit', '', base, {}), event: {} },
]
