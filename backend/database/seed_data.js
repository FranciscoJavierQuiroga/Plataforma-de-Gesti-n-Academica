use colegio;

print("🌱 Insertando datos de prueba...");

// =====================================
//   INSERTAR USUARIOS
// =====================================

// ADMINISTRADORES
const admin1 = db.usuarios.insertOne({
  correo: "admin1@colegio.edu.co",
  rol: "administrador",
  nombres: "Admin",
  apellidos: "Sistema",
  telefono: "3001234567",
  documento: "1234567890",
  activo: true,
  creado_en: Timestamp()
}).insertedId;

print("✔ Administrador creado: " + admin1);

// DOCENTES
const docente1 = db.usuarios.insertOne({
  correo: "juan.perez@colegio.edu.co",
  rol: "docente",
  nombres: "Juan",
  apellidos: "Pérez",
  telefono: "3105551234",
  documento: "10123456",
  codigo_empleado: "DOC001",
  especialidad: "Matemáticas",
  fecha_ingreso: ISODate("2020-01-15"),
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const docente2 = db.usuarios.insertOne({
  correo: "maria.lopez@colegio.edu.co",
  rol: "docente",
  nombres: "María",
  apellidos: "López",
  telefono: "3115552233",
  documento: "10234567",
  codigo_empleado: "DOC002",
  especialidad: "Español",
  fecha_ingreso: ISODate("2019-03-10"),
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const docente3 = db.usuarios.insertOne({
  correo: "carlos.garcia@colegio.edu.co",
  rol: "docente",
  nombres: "Carlos",
  apellidos: "García",
  telefono: "3125553344",
  documento: "10345678",
  codigo_empleado: "DOC003",
  especialidad: "Ciencias",
  fecha_ingreso: ISODate("2021-08-01"),
  activo: true,
  creado_en: Timestamp()
}).insertedId;

print("✔ 3 Docentes creados");

// ESTUDIANTES
const estudiante1 = db.usuarios.insertOne({
  correo: "carlos.ramirez@colegio.edu.co",
  rol: "estudiante",
  nombres: "Carlos",
  apellidos: "Ramírez",
  documento: "1001234567",
  codigo_est: "EST001",
  fecha_nacimiento: ISODate("2010-05-20"),
  direccion: "Cra 10 #20-30",
  nombre_acudiente: "Luis Ramírez",
  telefono_acudiente: "3005551111",
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const estudiante2 = db.usuarios.insertOne({
  correo: "ana.torres@colegio.edu.co",
  rol: "estudiante",
  nombres: "Ana",
  apellidos: "Torres",
  documento: "1001234568",
  codigo_est: "EST002",
  fecha_nacimiento: ISODate("2011-09-12"),
  direccion: "Calle 5 #10-22",
  nombre_acudiente: "Marta Torres",
  telefono_acudiente: "3015552222",
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const estudiante3 = db.usuarios.insertOne({
  correo: "sofia.mendez@colegio.edu.co",
  rol: "estudiante",
  nombres: "Sofía",
  apellidos: "Méndez",
  documento: "1001234569",
  codigo_est: "EST003",
  fecha_nacimiento: ISODate("2010-02-08"),
  direccion: "Av 3 #12-50",
  nombre_acudiente: "Roberto Méndez",
  telefono_acudiente: "3025553333",
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const estudiante4 = db.usuarios.insertOne({
  correo: "miguel.santos@colegio.edu.co",
  rol: "estudiante",
  nombres: "Miguel",
  apellidos: "Santos",
  documento: "1001234570",
  codigo_est: "EST004",
  fecha_nacimiento: ISODate("2010-11-15"),
  direccion: "Calle 8 #15-40",
  nombre_acudiente: "Patricia Santos",
  telefono_acudiente: "3035554444",
  activo: true,
  creado_en: Timestamp()
}).insertedId;

print("✔ 4 Estudiantes creados");

// =====================================
//   INSERTAR CURSOS
// =====================================

const curso1 = db.cursos.insertOne({
  nombre_curso: "Matemáticas 10° A",
  codigo_curso: "MAT10A",
  id_docente: docente1,
  grado: "10",
  periodo: "1",
  capacidad_max: NumberInt(40),
  activo: true,
  docente_info: {
    nombres: "Juan",
    apellidos: "Pérez",
    especialidad: "Matemáticas"
  }
}).insertedId;

const curso2 = db.cursos.insertOne({
  nombre_curso: "Español 10° A",
  codigo_curso: "ESP10A",
  id_docente: docente2,
  grado: "10",
  periodo: "1",
  capacidad_max: NumberInt(40),
  activo: true,
  docente_info: {
    nombres: "María",
    apellidos: "López",
    especialidad: "Español"
  }
}).insertedId;

const curso3 = db.cursos.insertOne({
  nombre_curso: "Ciencias 10° A",
  codigo_curso: "CIE10A",
  id_docente: docente3,
  grado: "10",
  periodo: "1",
  capacidad_max: NumberInt(40),
  activo: true,
  docente_info: {
    nombres: "Carlos",
    apellidos: "García",
    especialidad: "Ciencias"
  }
}).insertedId;

const curso4 = db.cursos.insertOne({
  nombre_curso: "Matemáticas 10° A - Periodo 2",
  codigo_curso: "MAT10B",
  id_docente: docente1,
  grado: "10",
  periodo: "2",
  capacidad_max: NumberInt(40),
  activo: true,
  docente_info: {
    nombres: "Juan",
    apellidos: "Pérez",
    especialidad: "Matemáticas"
  }
}).insertedId;

print("✔ 4 Cursos creados");

// =====================================
//   INSERTAR MATRÍCULAS + CALIFICACIONES
// =====================================

// Matrícula 1: Carlos en Matemáticas
const matricula1 = db.matriculas.insertOne({
  id_estudiante: estudiante1,
  id_curso: curso1,
  fecha_matricula: Timestamp(),
  estado: "activo",
  calificaciones: [
    {
      tipo: "Nota 1",
      nota: 4.2,
      nota_maxima: 5.0,
      peso: 0.33,
      fecha_eval: ISODate("2025-02-05"),
      comentarios: "Buen desempeño inicial"
    },
    {
      tipo: "Nota 2",
      nota: 3.8,
      nota_maxima: 5.0,
      peso: 0.33,
      fecha_eval: ISODate("2025-03-10"),
      comentarios: "Debe reforzar álgebra"
    },
    {
      tipo: "Nota 3",
      nota: 4.5,
      nota_maxima: 5.0,
      peso: 0.34,
      fecha_eval: ISODate("2025-04-15"),
      comentarios: "Excelente recuperación"
    }
  ],
  estudiante_info: {
    nombres: "Carlos",
    apellidos: "Ramírez",
    codigo_est: "EST001"
  },
  curso_info: {
    nombre_curso: "Matemáticas 10° A",
    codigo_curso: "MAT10A",
    grado: "10",
    periodo: "1"
  }
}).insertedId;

// Matrícula 2: Ana en Matemáticas
db.matriculas.insertOne({
  id_estudiante: estudiante2,
  id_curso: curso1,
  fecha_matricula: Timestamp(),
  estado: "activo",
  calificaciones: [
    { tipo: "Nota 1", nota: 4.5, nota_maxima: 5.0, peso: 0.33, fecha_eval: ISODate("2025-02-05") },
    { tipo: "Nota 2", nota: 4.2, nota_maxima: 5.0, peso: 0.33, fecha_eval: ISODate("2025-03-10") },
    { tipo: "Nota 3", nota: 4.8, nota_maxima: 5.0, peso: 0.34, fecha_eval: ISODate("2025-04-15") }
  ],
  estudiante_info: { nombres: "Ana", apellidos: "Torres", codigo_est: "EST002" },
  curso_info: { nombre_curso: "Matemáticas 10° A", codigo_curso: "MAT10A", grado: "10", periodo: "1" }
});

// Matrícula 3: Sofía en Español
db.matriculas.insertOne({
  id_estudiante: estudiante3,
  id_curso: curso2,
  fecha_matricula: Timestamp(),
  estado: "activo",
  calificaciones: [
    { tipo: "Nota 1", nota: 3.5, nota_maxima: 5.0, peso: 0.33, fecha_eval: ISODate("2025-02-05") },
    { tipo: "Nota 2", nota: 4.0, nota_maxima: 5.0, peso: 0.33, fecha_eval: ISODate("2025-03-10") },
    { tipo: "Nota 3", nota: 3.8, nota_maxima: 5.0, peso: 0.34, fecha_eval: ISODate("2025-04-15") }
  ],
  estudiante_info: { nombres: "Sofía", apellidos: "Méndez", codigo_est: "EST003" },
  curso_info: { nombre_curso: "Español 10° A", codigo_curso: "ESP10A", grado: "10", periodo: "1" }
});

// Matrícula 4: Miguel en Ciencias
db.matriculas.insertOne({
  id_estudiante: estudiante4,
  id_curso: curso3,
  fecha_matricula: Timestamp(),
  estado: "activo",
  calificaciones: [
    { tipo: "Nota 1", nota: 4.0, nota_maxima: 5.0, peso: 0.33, fecha_eval: ISODate("2025-02-05") },
    { tipo: "Nota 2", nota: 4.3, nota_maxima: 5.0, peso: 0.33, fecha_eval: ISODate("2025-03-10") },
    { tipo: "Nota 3", nota: 4.1, nota_maxima: 5.0, peso: 0.34, fecha_eval: ISODate("2025-04-15") }
  ],
  estudiante_info: { nombres: "Miguel", apellidos: "Santos", codigo_est: "EST004" },
  curso_info: { nombre_curso: "Ciencias 10° A", codigo_curso: "CIE10A", grado: "10", periodo: "1" }
});

print("✔ 4 Matrículas creadas con calificaciones");

// =====================================
//   INSERTAR AUDITORÍA
// =====================================

db.auditoria.insertOne({
  id_usuario: admin1,
  accion: "INICIALIZAR_BD",
  entidad_afectada: "sistema",
  detalles: { mensaje: "Base de datos inicializada con datos de prueba" },
  fecha: Timestamp()
});

print("✔ Registro de auditoría creado");

print("✅ Datos de prueba insertados correctamente");
print("\n📊 Resumen:");
print("   - Usuarios: " + db.usuarios.countDocuments());
print("   - Cursos: " + db.cursos.countDocuments());
print("   - Matrículas: " + db.matriculas.countDocuments());
print("   - Registros de auditoría: " + db.auditoria.countDocuments());