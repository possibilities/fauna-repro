const faunadb = require('faunadb')
const q = faunadb.query

// Admin secret created at https://app.fauna.com/keys
const {
  faunadb_name: dbName,
  faunadb_secret: rootSecret
} = process.env

async function main() {
  const rootClient = new faunadb.Client({ secret: rootSecret })

  // Delete db if exists
  await rootClient.query(
    q.Delete(q.Database(dbName))
  ).catch(function() {})

  await rootClient.query(
    q.CreateDatabase({ name: dbName })
  )

  const { secret: serverSecret } = await rootClient.query(
    q.CreateKey({ role: 'server', database: q.Database(dbName) })
  )
  const { secret: adminSecret } = await rootClient.query(
    q.CreateKey({ role: 'admin', database: q.Database(dbName) })
  )

  const adminClient = new faunadb.Client({ secret: adminSecret })
  const serverClient = new faunadb.Client({ secret: serverSecret })

  // Create collections
  await serverClient.query(q.CreateCollection({ name: 'widgets' }))
    .catch(function(error) { console.info('widgets:', error.message) })

  // Create user collection and index
  await serverClient.query(q.CreateCollection({ name: 'users' }))
    .catch(function(error) { console.info('users:', error.message) })

  await serverClient.query(
    q.CreateIndex({
      name: 'users_by_email',
      permissions: { read: 'public' },
      source: q.Collection('users'),
      terms: [{ field: ['data', 'email'] }],
      unique: true
    })
  ).catch(function(error) { console.info('users_by_email:', error.message) })

  // Delete role if exists
  await adminClient.query(
    q.Delete(q.Role('access_content'))
  ).catch(function () {})

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
