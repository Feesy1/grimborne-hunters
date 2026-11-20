# Выпуск Grimborne Hunters в Google Play Market (Android / Capacitor)

Краткое практическое руководство по упаковке веб-игры **Grimborne Hunters** в нативный Android App Bundle (`.aab`) с помощью **Capacitor** без тяжёлого бандлера.

> После сжатия 50 активных `.glb` (Draco + WebP) чистый веб-пакет `www/` весит **~59 МиБ** (внутри сжатого AAB — **~50 МиБ**), что с большим запасом укладывается в базовый лимит Google Play (**200 МБ** без Play Asset Delivery).

---

## 1. Предварительные требования

1. **Node.js 20 LTS** (вместе с `npm` / `npx`) — установить с [nodejs.org](https://nodejs.org/) или через `winget install OpenJS.NodeJS.LTS`.
2. **Android Studio** (актуальный релиз, со встроенным **JDK 17** и **Android SDK API 34 / 35** + Build-Tools).
3. Аккаунт разработчика **Google Play Console**.

---

## 2. Первичная инициализация проекта Android

Выполните в корне `D:\GrimborneHunters`:

```powershell
# 1. Установить зависимости Capacitor (@capacitor/core, @capacitor/cli, @capacitor/android)
npm install

# 2. Собрать чистый whitelist веб-ресурсов в www/ (без *.blend, бэкапов и неиспользуемых моделей)
npm run build:www

# 3. Создать нативный проект android/ (выполняется 1 раз)
npm run cap:add:android

# 4. Синхронизировать www/ и capacitor.config.json с android/ и открыть в Android Studio
npm run android:prepare
```

При последующих обновлениях игры достаточно запускать:
```powershell
npm run cap:sync
```

---

## 3. Настройка Landscape, Fullscreen Immersive и WebView

После `npm run cap:add:android` внесите два небольших изменения в сгенерированную папку `android/`:

### 3.1. `android/app/src/main/AndroidManifest.xml`
В теге `<activity android:name=".MainActivity" ...>` закрепите альбомную ориентацию и аппаратное ускорение WebGL:

```xml
<activity
    android:name=".MainActivity"
    android:screenOrientation="sensorLandscape"
    android:hardwareAccelerated="true"
    android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
    android:launchMode="singleTask"
    android:exported="true">
```

### 3.2. `android/app/src/main/java/com/grimbornehunters/game/MainActivity.java`
Включите полноэкранный иммерсивный режим (скрытие статус-бара и системных кнопок навигации с выездом по свайпу):

```java
package com.grimbornehunters.game;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat ctrl = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (ctrl != null) {
            ctrl.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            ctrl.hide(WindowInsetsCompat.Type.systemBars());
        }
    }
}
```

> В `capacitor.config.json` задано `"androidScheme": "https"` — игра открывается на защищённом origin `https://localhost`, поэтому ES-модули, `vendor/draco/draco_decoder.wasm` (WebAssembly), WebGL2 и `localStorage` работают без ошибок CORS.

### 3.3. Иконка приложения
В Android Studio: правый клик по `app/res` → **New → Image Asset** → выберите `D:\GrimborneHunters\assets\icon-512.png`, фон `#0b0a10` (Adaptive Icon).

---

## 4. Подпись Keystore и сборка релизного `.aab`

### 4.1. Создание релизного ключа (1 раз!)
> **ВАЖНО:** храните `.jks` / `.keystore` и пароли **вне репозитория** (файлы `*.keystore` / `*.jks` уже исключены в `.gitignore`). Потеря ключа сделает невозможным выпуск обновлений приложения!

```powershell
keytool -genkeypair -v `
  -keystore D:\GrimborneKeys\grimborne-release.jks `
  -alias grimborne `
  -keyalg RSA -keysize 2048 -validity 10000
```

### 4.2. Сборка `.aab` в Android Studio
1. В `android/app/build.gradle` проверьте `versionCode` (целое число, увеличивать в каждом релизе) и `versionName` (например, `"1.0.0"`), а также `targetSdk` (актуальный минимум Google Play — API 34/35).
2. В меню Android Studio выберите **Build → Generate Signed App Bundle / APK…** → **Android App Bundle** → укажите `grimborne-release.jks`, alias `grimborne` и вариант **release**.
3. Готовый файл появится в:
   `android/app/release/app-release.aab`
4. Загрузите `.aab` в **Google Play Console → Testing → Internal testing** (внутреннее тестирование), проверьте на реальных устройствах, затем переведите в **Production**.

---

## 5. Подключение AdMob и Google Play Games поверх `js/yandexSdk.js`

Вся платформенная логика игры (реклама, облачные сейвы, лидерборд `endless_kills`, язык) уже изолирована за одним контрактом в `js/yandexSdk.js`. Чтобы не менять `main.js`, `combat.js`, `progression.js` и `ui.js`, достаточно добавить ветку определения Capacitor (`Boolean(window.Capacitor?.isNativePlatform?.())`) внутри адаптера SDK:

| Метод адаптера (`js/yandexSdk.js`) | Яндекс Игры (`ysdk`) | Android / Google Play (Capacitor) |
|---|---|---|
| `showInterstitial()` | `ysdk.adv.showFullscreenAdv` | `@capacitor-community/admob` → `AdMob.prepareInterstitial` + `showInterstitial` (с паузой аудио) |
| `showRewarded(tag)` | `ysdk.adv.showRewardedVideo` | `@capacitor-community/admob` → `AdMob.prepareRewardVideoAd` + `showRewardVideoAd` (возвращать `true` только по событию `onRewarded`) |
| `loadCloudData()` / `saveCloudData(obj, immediate)` | `player.getData` / `player.setData` | Плагин **Google Play Games Services v2** (Snapshots API) + существующий `mergeCloudState()` в `js/progression.js` |
| `setLeaderboardScore('endless_kills', score)` | `ysdk.getLeaderboards()` | Google Play Games Services Leaderboards (сопоставить `'endless_kills'` → ID таблицы лидеров из Play Console) |
| `getLang()` | `ysdk.environment.i18n.lang` | `navigator.language.startsWith('en') ? 'en' : 'ru'` |

### Быстрая установка AdMob для Capacitor
```powershell
npm install @capacitor-community/admob
npm run cap:sync
```
Добавьте `APPLICATION_ID` из кабинета AdMob в `android/app/src/main/AndroidManifest.xml` внутри `<application>`:
```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>
```
*(Во время разработки всегда используйте тестовые Ad Unit ID от Google, чтобы избежать блокировки аккаунта AdMob.)*

---

## 6. Проверка сборки Яндекс Игр

Скрипт `Собрать_архив_Яндекс_Игры.cmd` использует строгий белый список (`index.html`, `manifest.json`, `css/`, `js/`, `vendor/`, очищенная `assets/`), поэтому файлы Capacitor (`package.json`, `capacitor.config.json`, `PLAY_MARKET_GUIDE.md`, `www/`, `android/`, `node_modules/`) **никогда не попадают** в архив для Яндекс Игр.
