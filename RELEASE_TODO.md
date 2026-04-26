# 🚀 Release Checklist – LehrPlan

Stand: April 2026  
Plattform: iOS (App Store) and Android( Play Store)

---

## 🔴 Kritisch (muss vor Release fertig sein)

### 1. In-App-Käufe (IAP) — echte Integration

- [ ] `hooks/usePurchases.ts` ist aktuell **Mock-Logik** (immer `isSubscribed: false`)
- [ ] Echte Integration mit `react-native-purchases` (RevenueCat) oder `react-native-iap`
- [ ] Produkt-IDs in App Store Connect anlegen (Jahres-Abo, Monats-Abo, Trial)
- [ ] `AppContext.checkSubscriptionStatus()` auf echte Kaufvalidierung umstellen
- [ ] Receipt Validation serverseitig absichern (kein reiner Client-Check)

### 2. Live Activity (iOS Dynamic Island / Lock Screen)

- [ ] Xcode: **Widget Extension Target** hinzufügen (`File → New Target → Live Activity`)
- [ ] Swift: `ActivityAttributes` Struct definieren (startTime, timer, evaluatedCount)
- [ ] Swift: `ActivityKit` starten/updaten/beenden im nativen Layer
- [ ] Expo Module schreiben als JS-Bridge (`modules/LiveActivityModule`)
- [ ] `lesson-active.tsx`: `InAppActivityBanner` durch echten `LiveActivityModule.start()` Aufruf ersetzen
- [ ] Fallback: `InAppActivityBanner` bleibt für Geräte ohne Dynamic Island (iOS < 16.1)
- [ ] `NSSupportsLiveActivities = YES` in `Info.plist` eintragen
- [ ] In `app.json`: Widget Extension in `expo.ios.entitlements` eintragen

### 3. Push Notifications

- [ ] APNs-Zertifikat in Apple Developer Portal erstellen
- [ ] `expo-notifications` konfigurieren mit echtem Server-Token
- [ ] Notification Permission explizit anfragen (aktuell nur bei Unterrichtsstart)
- [ ] Benachrichtigungen testen auf echtem Gerät (funktioniert nicht im Simulator)

### 4. Datenschutz & App Store Compliance

- [ ] Privacy Policy URL einpflegen (App Store Connect + in der App)
- [ ] `PrivacyInfo.xcprivacy` vollständig ausfüllen (wird bereits generiert, Inhalt prüfen)
- [ ] App Store Datenschutz-Fragebogen ausfüllen (welche Daten werden gesammelt?)
- [ ] DSGVO-konformes Consent-Banner falls Analytics verwendet werden

---

## 🟡 Wichtig (sollte vor Release fertig sein)

### 5. App Store Assets

- [ ] App Icon in allen erforderlichen Größen (via `app.json` → `expo.icon`)
- [ ] Screenshots für alle Geräte: iPhone 6.7", 6.5", 5.5" (Pflicht)
- [ ] App Preview Video (optional, erhöht Conversion)
- [ ] Kurz- und Langbeschreibung auf Deutsch schreiben
- [ ] Keywords recherchieren und eintragen
- [ ] Support-URL / Marketing-URL einpflegen

### 6. Subscription-Flow testen

- [ ] Trial-Ablauf testen (AsyncStorage manuell manipulieren für Test)
- [ ] Kauf-Wiederherstellung testen (`Restore Purchases` Button im Paywall)
- [ ] Abo-Kündigung testen (was passiert nach Ablauf?)
- [ ] `isSubscribed` Guard beim App-Start mit abgelaufenem Trial testen
- [ ] Edge-Case: Was passiert bei Netzwerkfehler während IAP-Kauf?

### 7. Onboarding

- [ ] Finalen Onboarding-Flow auf echtem Gerät durchlaufen
- [ ] Redirect nach Onboarding → Paywall korrekt (kein Bypass möglich)
- [ ] Onboarding-State wird nach Reset korrekt gelöscht

### 8. Sicherheit

- [ ] Alle `console.log` mit sensiblen Daten entfernen (Passwörter, Keys)
- [ ] PIN-Hash in SecureStore verifizieren (bereits implementiert, finalen Test durchführen)
- [ ] API Keys / Secrets aus Code entfernen → `.env` / EAS Secrets

---

## 🟢 Nice to Have (kann auch nach Release kommen)

### 9. Android

- [ ] `expo prebuild --platform android` ausführen
- [ ] Foreground Service Notification für Unterrichtsmodus
  - `expo-notifications` foreground service konfigurieren
  - Notification Channel anlegen
  - Timer + Fortschritt in Notification anzeigen
- [ ] Android App Bundle (.aab) bauen und im Play Store einreichen

### 10. Performance & Qualität

- [ ] Alle Screens mit großen Klassen testen (50+ Schüler)
- [ ] Memory-Leaks beim Wechsel zwischen Tabs prüfen
- [ ] Lazy Loading für große Datenmengen (FlatList statt ScrollView bei >30 Einträgen)
- [ ] Expo SDK auf neueste stabile Version updaten (aktuell SDK 52/53)

### 11. Analytics / Crash Reporting

- [ ] Sentry oder Expo Insights einbinden
- [ ] Key Events tracken (Unterricht gestartet, Abo gekauft, etc.)

---

## 📋 Build & Submission

```bash
# 1. Prebuild (generiert natives Xcode-Projekt)
npx expo prebuild --platform ios --clean

# 2. Dependencies installieren
cd ios && pod install && cd ..

# 3. In Xcode: Product → Archive
# 4. In Xcode Organizer: Distribute App → App Store Connect

# Alternativ mit EAS Build:
eas build --platform ios --profile production
eas submit --platform ios
```

### app.json vor Release prüfen:

- [ ] `version` erhöht (Semantic Versioning: `1.0.0`)
- [ ] `buildNumber` erhöht (iOS: Integer, z.B. `1`)
- [ ] `bundleIdentifier` korrekt gesetzt
- [ ] `name` und `slug` korrekt
- [ ] `scheme` für Deeplinks gesetzt

---

## 🔗 Wichtige Links

- [App Store Connect](https://appstoreconnect.apple.com)
- [Apple Developer Portal](https://developer.apple.com)
- [ActivityKit Dokumentation](https://developer.apple.com/documentation/activitykit)
- [RevenueCat (IAP)](https://www.revenuecat.com)
- [EAS Build](https://docs.expo.dev/build/introduction/)
