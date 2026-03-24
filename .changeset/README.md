# Changesets

This directory contains changeset files used to manage versioning and changelogs.

## How to add a changeset

```bash
npx changeset add
```

Select the bump type (patch / minor / major) and write a one-line summary of your change.
The generated `.md` file should be committed alongside your PR.

## Skip a version bump

If your PR does not need a version bump (e.g. CI, docs, tests), add the `skip-changelog`
label to the PR on GitHub. The changeset check will be skipped automatically.
