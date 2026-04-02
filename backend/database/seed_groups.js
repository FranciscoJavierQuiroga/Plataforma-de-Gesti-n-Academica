// ==========================================
//   SEED DATA: GRUPOS Y HORARIOS
// ==========================================

use colegio_db;

print("\n🎓 Creando grupos...");

// Obtener docentes para directores de grupo
const docente1 = db.usuarios.findOne({correo: "juan.perez@colegio.edu.co"})._id;
const docente2 = db.usuarios.findOne({correo: "maria.lopez@colegio.edu.co"})._id;
const docente3 = db.usuarios.findOne({correo: "carlos.garcia@colegio.edu.co"})._id;

// ==========================================
//   GRUPOS GRADO 10
// ==========================================

const grupo10A = db.grupos.insertOne({
  nombre_grupo: "10°A",
  grado: "10",
  jornada: "mañana",
  año_lectivo: "2025",
  director_grupo: docente1,
  capacidad_max: NumberInt(40),
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const grupo10B = db.grupos.insertOne({
  nombre_grupo: "10°B",
  grado: "10",
  jornada: "mañana",
  año_lectivo: "2025",
  director_grupo: docente2,
  capacidad_max: NumberInt(38),
  activo: true,
  creado_en: Timestamp()
}).insertedId;

print("✔ Grupos de grado 10 creados");

// ==========================================
//   GRUPOS GRADO 11
// ==========================================

const grupo11A = db.grupos.insertOne({
  nombre_grupo: "11°A",
  grado: "11",
  jornada: "mañana",
  año_lectivo: "2025",
  director_grupo: docente3,
  capacidad_max: NumberInt(35),
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const grupo11B = db.grupos.insertOne({
  nombre_grupo: "11°B",
  grado: "11",
  jornada: "mañana",
  año_lectivo: "2025",
  director_grupo: docente1,
  capacidad_max: NumberInt(35),
  activo: true,
  creado_en: Timestamp()
}).insertedId;

print("✔ Grupos de grado 11 creados");

// ==========================================
//   ASIGNAR ESTUDIANTES A GRUPOS
// ==========================================

// Grupo 10°A
db.usuarios.updateMany(
  { codigo_est: { $in: ["EST001", "EST002", "EST003", "EST004"] } },
  { $set: { grupo: "10°A" } }
);

// Grupo 10°B
db.usuarios.updateMany(
  { codigo_est: { $in: ["EST011", "EST012"] } },
  { $set: { grupo: "10°B" } }
);

// Grupo 11°A
db.usuarios.updateMany(
  { codigo_est: { $in: ["EST005", "EST006", "EST007", "EST008"] } },
  { $set: { grupo: "11°A" } }
);

// Grupo 11°B
db.usuarios.updateMany(
  { codigo_est: { $in: ["EST009", "EST010"] } },
  { $set: { grupo: "11°B" } }
);

print("✔ Estudiantes asignados a grupos");

// ==========================================
//   ACTUALIZAR CURSOS CON CAMPO GRUPO
// ==========================================

// Los cursos ahora pertenecen a un grupo específico
db.cursos.updateOne(
  { codigo_curso: "MAT10A" },
  { $set: { grupo: "10°A" } }
);

db.cursos.updateOne(
  { codigo_curso: "ESP10A" },
  { $set: { grupo: "10°A" } }
);

db.cursos.updateOne(
  { codigo_curso: "CIE10A" },
  { $set: { grupo: "10°A" } }
);

db.cursos.updateOne(
  { codigo_curso: "ESP10B" },
  { $set: { grupo: "10°B" } }
);

db.cursos.updateOne(
  { codigo_curso: "ESP11A" },
  { $set: { grupo: "11°A" } }
);

db.cursos.updateOne(
  { codigo_curso: "LIT11A" },
  { $set: { grupo: "11°A" } }
);

db.cursos.updateOne(
  { codigo_curso: "MAT11A" },
  { $set: { grupo: "11°A" } }
);

print("✔ Cursos actualizados con campo 'grupo'");

// ==========================================
//   CREAR HORARIOS POR GRUPO
// ==========================================

// Horario para 10°A
db.horarios.insertOne({
  grupo: "10°A",
  año_lectivo: "2025",
  horario: [
    // LUNES
    {
      hora_inicio: "07:00",
      hora_fin: "08:00",
      dia: "lunes",
      id_curso: db.cursos.findOne({codigo_curso: "MAT10A"})._id,
      curso_info: {
        nombre_curso: "Matemáticas 10°A",
        codigo_curso: "MAT10A",
        docente_nombres: "Juan Pérez",
        salon: "Aula 201"
      }
    },
    {
      hora_inicio: "08:00",
      hora_fin: "09:00",
      dia: "lunes",
      id_curso: db.cursos.findOne({codigo_curso: "ESP10A"})._id,
      curso_info: {
        nombre_curso: "Español 10°A",
        codigo_curso: "ESP10A",
        docente_nombres: "María López",
        salon: "Aula 202"
      }
    },
    {
      hora_inicio: "09:00",
      hora_fin: "10:00",
      dia: "lunes",
      id_curso: db.cursos.findOne({codigo_curso: "CIE10A"})._id,
      curso_info: {
        nombre_curso: "Ciencias 10°A",
        codigo_curso: "CIE10A",
        docente_nombres: "Carlos García",
        salon: "Laboratorio 1"
      }
    },
    {
      hora_inicio: "10:00",
      hora_fin: "10:30",
      dia: "lunes",
      curso_info: {
        nombre_curso: "DESCANSO",
        codigo_curso: "DESCANSO"
      }
    },
    // MARTES
    {
      hora_inicio: "07:00",
      hora_fin: "08:00",
      dia: "martes",
      id_curso: db.cursos.findOne({codigo_curso: "ESP10A"})._id,
      curso_info: {
        nombre_curso: "Español 10°A",
        codigo_curso: "ESP10A",
        docente_nombres: "María López",
        salon: "Aula 202"
      }
    },
    {
      hora_inicio: "08:00",
      hora_fin: "09:00",
      dia: "martes",
      id_curso: db.cursos.findOne({codigo_curso: "MAT10A"})._id,
      curso_info: {
        nombre_curso: "Matemáticas 10°A",
        codigo_curso: "MAT10A",
        docente_nombres: "Juan Pérez",
        salon: "Aula 201"
      }
    }
    // Agregar más bloques según necesites...
  ],
  creado_en: Timestamp(),
  actualizado_en: Timestamp()
});

print("✔ Horario para 10°A creado");

// Horario para 11°A
db.horarios.insertOne({
  grupo: "11°A",
  año_lectivo: "2025",
  horario: [
    {
      hora_inicio: "07:00",
      hora_fin: "08:00",
      dia: "lunes",
      id_curso: db.cursos.findOne({codigo_curso: "MAT11A"})._id,
      curso_info: {
        nombre_curso: "Matemáticas 11°A",
        codigo_curso: "MAT11A",
        docente_nombres: "Juan Pérez",
        salon: "Aula 301"
      }
    },
    {
      hora_inicio: "08:00",
      hora_fin: "09:00",
      dia: "lunes",
      id_curso: db.cursos.findOne({codigo_curso: "ESP11A"})._id,
      curso_info: {
        nombre_curso: "Español 11°A",
        codigo_curso: "ESP11A",
        docente_nombres: "María López",
        salon: "Aula 302"
      }
    }
    // Agregar más bloques...
  ],
  creado_en: Timestamp(),
  actualizado_en: Timestamp()
});

print("✔ Horario para 11°A creado");

print("\n✅ Grupos y horarios creados exitosamente");
print("📊 Resumen:");
print("   - Grupos creados: " + db.grupos.countDocuments());
print("   - Estudiantes con grupo: " + db.usuarios.countDocuments({ grupo: { $exists: true } }));
print("   - Cursos con grupo: " + db.cursos.countDocuments({ grupo: { $exists: true } }));
print("   - Horarios creados: " + db.horarios.countDocuments());