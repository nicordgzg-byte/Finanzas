# Mis Finanzas

App sencilla para llevar tus finanzas personales: ingresos, egresos, balance actual y deudas con abonos. Funciona en el celular y se puede instalar en la pantalla de inicio.

- **Código:** GitHub
- **Publicación:** Vercel (sitio estático, sin paso de compilación)
- **Datos e inicio de sesión:** Supabase (cada usuario solo ve sus propios registros)

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la app |
| `styles.css` | Diseño (claro y oscuro, móvil y escritorio) |
| `app.js` | Lógica: acceso, registros, balance, gráfica y deudas |
| `config.js` | URL y anon key de tu proyecto de Supabase |
| `supabase/schema.sql` | Tablas `movimientos` y `deudas` con sus reglas de seguridad |
| `manifest.webmanifest`, `icons/` | Ícono y datos para instalarla en el celular |

## Puesta en marcha

### 1. Supabase
1. Crea un proyecto nuevo en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor**, pega el contenido de `supabase/schema.sql` y dale **Run**.
3. Ve a **Project Settings → API** y copia la **Project URL** y la **anon public key**.
4. Pégalas en `config.js` y sube el cambio a GitHub.

La anon key está pensada para ir en el navegador. Lo que protege tus datos son las reglas de seguridad (RLS) del archivo SQL: cada cuenta solo puede leer y modificar sus propios registros.

### 2. Vercel
1. En [vercel.com](https://vercel.com) elige **Add New → Project** e importa este repositorio.
2. Framework Preset: **Other**. No necesita build command ni variables de entorno.
3. Dale **Deploy**. Cada vez que subas cambios a GitHub, Vercel publica la nueva versión sola.

### 3. Conectar el dominio de Vercel con Supabase
En Supabase ve a **Authentication → URL Configuration** y pon tu dominio de Vercel (por ejemplo `https://mis-finanzas.vercel.app`) en **Site URL**. Así el correo de confirmación te regresa a tu app.

### 4. Crea tu cuenta y ciérrala a otros
1. Abre tu app, toca **¿Primera vez? Crea tu cuenta** y confirma el correo que te llega.
2. Después, en Supabase ve a **Authentication → Sign In / Providers → Email** y desactiva **Allow new users to sign up**. Así nadie más puede registrarse en tu app.

### 5. Instálala en el celular
- **iPhone (Safari):** Compartir → **Agregar a pantalla de inicio**.
- **Android (Chrome):** menú ⋮ → **Agregar a pantalla principal** o **Instalar app**.

## Probar en tu computadora
Cualquier servidor estático sirve, por ejemplo:

```bash
npx serve .
```
