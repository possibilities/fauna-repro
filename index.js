const faunadb = require('faunadb')
const q = faunadb.query

const {
  faunadb_name: dbName,
  faunadb_secret: rootSecret
} = process.env

async function main() {
  const rootClient = new faunadb.Client({ secret: rootSecret })

  if (await rootClient.query(q.Exists(q.Database(dbName)))) {
    await rootClient.query(
      q.Delete(q.Database(dbName))
    )
  }

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
  await serverClient.query(
    q.CreateIndex({
      name: 'all_widgets',
      source: q.Collection('widgets')
    })
  )

  // Create user collection and index
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

  await adminClient.query(
    q.CreateRole({
      name: 'access_content',
      membership: [{ resource: q.Collection('users') }],
      privileges: [
        {
          resource: q.Index('all_widgets'),
          actions: { read: true }
        },
        {
          resource: q.Collection('widgets'),
          actions: { read: true, create: true }
        }
      ]
    })
  )

  await serverClient.query(
    q.Create(
      q.Collection('users'),
      {
        credentials: { password: 'secret password' },
        data: { email: 'alice@site.example' }
      }
    )
  )

  const { secret: aliceSecret } =
    await serverClient.query(
      q.Login(
        q.Match(q.Index('users_by_email'), 'alice@site.example'),
        { password: 'secret password' }
      )
    )

  const aliceClient = new faunadb.Client({ secret: aliceSecret })

  await aliceClient.query(
    q.Create(
      q.Collection('widgets'),
      { data: { title: 'foo' } }
    )
  )

  await aliceClient.query(
    q.Create(
      q.Collection('widgets'),
      { data: { title: 'bar' } }
    )
  )

  console.log(
    (await aliceClient.query(
      q.Map(
        q.Paginate(q.Match(q.Index('all_widgets'))),
        q.Lambda('widget', q.Get(q.Var('widget')))
      )
    )).data.map(doc => doc.data)
  )
}

main().catch(error => console.error(error))
