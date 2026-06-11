# Specifikace modulu: <Název>

> Krátký dokument (1–2 strany), který se schvaluje PŘED stavbou modulu.
> Píše se lidsky — Petr mu musí rozumět celý.

## 1. Účel
K čemu modul je, kdo ho používá a kdy. Jedna–dvě věty.

## 2. Obrazovky
Seznam obrazovek/sekcí + slovní wireframe (co je kde, podle `docs/UI-ZASADY.md`).
Odkaz na mockup, pokud existuje.

## 3. Pole a data
Co se eviduje (lidsky) + mapování na tabulky z `docs/DATOVY-MODEL.md`.
Které číselníky (Seznamy) se používají a jejich výchozí položky.

## 4. Pravidla a stavy
Stavy záznamu, kdo co smí (práva), validace, co se děje automaticky.

## 5. Akce (kontextové)
Co jde udělat odkud — akce vždy u věci, ne v menu jinde.

## 6. Prázdné stavy
Doslovné texty + kontextová akce pro každý prázdný seznam/sekci.

## 7. Hotovo, když… (checklist)
- [ ] … (ověřitelné body: co musí jít proklikat/otestovat)
- [ ] typecheck zelený, HTTP testy projdou
- [ ] odpovídá UI zásadám (hierarchie, chipy, prázdné stavy, aria, mobil)
