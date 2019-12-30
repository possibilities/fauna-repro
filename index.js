const faunadb = require('faunadb')
const q = faunadb.query

// Admin secret created at https://app.fauna.com/keys
const { faunadb_secret: adminSecret } = process.env

async function main() {
  const adminClient = new faunadb.Client({ secret: adminSecret })

  // Delete db if exists
  await adminClient.query(
    q.Delete(q.Database('my_db'))
  ).catch(function() {})

  await adminClient.query(
    q.CreateDatabase({ name: 'my_db' })
  )

  // Get a server secret for created database
  const { secret: serverSecret } = await adminClient.query(
    q.CreateKey({
      role: 'server',
      database: q.Database('my_db')
    })
  )

  // New client with server secret
  const serverClient = new faunadb.Client({ secret: serverSecret })

  // Create collections
  await serverClient.query(q.CreateCollection({ name: 'widgets' }))
  await serverClient.query(q.CreateCollection({ name: 'users' }))
  await serverClient.query(
    q.CreateIndex({
      name: 'users_by_email',
      permissions: { read: 'public' },
      source: q.Collection('users'),
      terms: [{ field: ['data', 'email'] }],
      unique: true
    })
  )

  // Delete role if exists
  await adminClient.query(
    q.Delete(q.Role('access_content'))
  ).catch(function () {})

  // Why does this fail?
  await adminClient.query(
    q.CreateRole({
      name: 'access_content',
      membership: [{ resource: q.Collection('users') }],
      privileges: [{
        resource: q.Collection('widgets'),
        actions: { read: true }
      }]
    })
  )
}

main().catch(error => console.error(error))
