import { Elysia, t } from 'elysia'
import { Database } from "bun:sqlite";
import { randomId } from 'elysia/utils';

const db = new Database(":memory:");

db.exec(`CREATE TABLE IF NOT EXISTS GRUPOS (
  ID TEXT,
  SORTEIO TEXT,
  PRIMARY KEY(ID)
);`)

db.exec(`CREATE TABLE IF NOT EXISTS PARTICIPANTES (
  NOME TEXT,
  ID_GRUPO TEXT,
  PRIMARY KEY(NOME, ID_GRUPO)
);`)

class Grupo { sorteio?: string }
class Participante { nome?: string }
class Sorteio { participante?: string }

new Elysia()
	.post('/grupos', () => {
    const id = randomId()
    db.prepare(`INSERT INTO GRUPOS (ID) VALUES ($id);`)
      .all({ $id: id })
    return { id }
  })
	.post('/grupos/:id_grupo/participantes', ({ body: { nome }, params }) =>{
    db.prepare(
      `INSERT INTO PARTICIPANTES (NOME, ID_GRUPO)
      VALUES ($nome, $id_grupo);`
    )
      .all({ $nome: nome, $id_grupo: params.id_grupo })
  }, {
    body: t.Object({ nome: t.String() })
  })
	.post('/grupos/:id_grupo/sorteios', ({ params, set }) => {
    const sorteio = db.prepare(`
      SELECT NOME as nome, RANDOM()
      FROM PARTICIPANTES
      WHERE ID_GRUPO = $id_grupo
      ORDER BY 2;`
    )
      .as(Participante)
      .all({ $id_grupo: params.id_grupo })
      .map((participante, i, array) => {
        const j = i === array.length - 1 ? 0 : i + 1
        return {
          participante: participante.nome,
          amigo_secreto: array[j].nome
        }
      })
    db.prepare(`UPDATE GRUPOS SET SORTEIO = $sorteio WHERE ID = $id_grupo;`)
      .all({
        $id_grupo: params.id_grupo,
        $sorteio: JSON.stringify(sorteio)
      })
    set.status = 201
  })
  .get('/grupos/:id_grupo/participantes/:nome/amigo_secreto', ({ params, set }) => {
    const grupos = db.prepare(`SELECT SORTEIO as sorteio FROM GRUPOS WHERE ID = $id_grupo;`)
      .as(Grupo)
      .all({ $id_grupo: params.id_grupo })
    if (grupos.length === 0) {
      set.status = 404
      return
    }
    try {
      const parsedSorteio = JSON.parse(grupos[0].sorteio!) as Sorteio[]
      const participante = parsedSorteio.find(sorteio => sorteio.participante === params.nome)
      if (participante === undefined) { set.status = 404; return }
      return participante
    }
    catch (e) {}
    set.status = 404; return
  })
	.listen(3000)