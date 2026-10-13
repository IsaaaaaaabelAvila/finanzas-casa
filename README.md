# Finanzas Casa

App para llevar ingresos, egresos, tarjetas, pagos a meses y metas, de forma personal y de la casa.
Corre en computadora (navegador, instalable como app) y en Android (APK). Se sincroniza en la nube con Supabase.

## Como funciona la privacidad
- Cada movimiento/cuenta/meta es **"Mio"** (solo lo ves tu) o **"Casa"** (lo ven los dos).
- Esto lo garantiza la base de datos (Row Level Security), no solo la pantalla.
- Filtro arriba: **Todo / Mio / Casa**.

## 1. Crear la nube (una sola vez, gratis, ~5 min)
1. Entra a https://supabase.com y crea un proyecto.
2. En **SQL Editor > New query**, pega todo `supabase.sql` y presiona **Run**.
3. En **Project Settings > API** copia **Project URL** y **anon public key**.
4. (Recomendado) En **Authentication > Providers > Email** desactiva "Confirm email" para entrar sin confirmar correo.
5. Copia `.env.example` a `.env` y pega ahi la URL y la key.

## 2. Probar en la computadora
```
npm install
npm run dev
```
Abre la direccion que muestra (http://localhost:5173). Crea tu cuenta, crea la casa y comparte el **codigo de invitacion** (Ajustes) con tu pareja; el se registra y elige "Unirme con codigo".

## 3. Generar el APK
Requisitos: Android Studio (incluye el SDK) y Java 17.
```
npm run android:sync          # compila y copia a Android (la primera vez antes: npx cap add android)
npm run android:open          # abre Android Studio
```
En Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**. Pasa el `.apk` a tu celular e instalalo.
Al abrir la app acepta el permiso de notificaciones.

## 4. Uso en la computadora sin instalar nada
Publica la carpeta `dist` (tras `npm run build`) en Netlify / Vercel / GitHub Pages; ahi puedes "Instalar app" desde Chrome/Edge.

## Recordatorios
- Viernes, sabado, domingo y lunes a la hora configurada (Ajustes): "registra tus movimientos".
- 5, 3 y 1 dia antes del corte de una tarjeta con gasto minimo, si aun falta gastar.
  Se recalculan cada vez que abres la app o cambian los datos.
- Las notificaciones programadas solo funcionan en el APK; en el navegador ves un aviso dentro de la app.

## Notas de calculo
- Periodo de la tarjeta: del dia siguiente al corte anterior, hasta el dia de corte.
- Gasto minimo cuenta egresos de esa tarjeta en el periodo + compras a meses con fecha de compra en el periodo.
- Pago de tarjeta: registra una *Transferencia* desde tu cuenta de debito hacia la tarjeta.
- Moneda: pesos mexicanos (cambiar en `src/calc.ts`, funcion `money`).
