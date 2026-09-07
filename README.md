# gry-od-widzów

Strona z grami **Blue i Bingo — Wielka ucieczka**, **Klawiatura** oraz **Miejskie życie 3D**.

Zagraj: https://mikolajczapski2016-dev.github.io/gry-od-widzow/

Pliki strony i gier znajdują się w `public/`. Każdy push do `main` publikuje stronę przez GitHub Pages.

Lokalny podgląd: `python3 -m http.server 8080 --directory public`, następnie otwórz http://localhost:8080.

Blue i Bingo to nieoficjalna gra fanowska. Informacje o ilustracjach i licencja Three.js znajdują się w katalogu gry.

Miejskie życie 3D to autorska gra z otwartym miastem: pieszy ruch, auta, dostawy,
sklep, dom, walka i pościgi policji. Sterowanie: WASD/strzałki, E (auto), F (cios),
Spacja (strzał), J (zajęcie), P (pauza). Na telefonie dostępne są joystick i przyciski.
Powrót do listy gier znajduje się w ustawieniach. Portfel, liczba dostaw i ustawienie
dźwięku zapisują się lokalnie. Gra korzysta z lokalnej kopii Three.js oraz jej licencji
w `public/blue-i-bingo/vendor/`.

Grafika Miejskiego życia: widok zza postaci, modele z zaokrągloną geometrią,
animowane kończyny, cienie i lokalne tekstury fotograficzne (źródła w
`public/miejskie-zycie/assets/SOURCES.md`). Strzałki/WASD działają zgodnie
z kierunkami na ekranie zarówno pieszo, jak i w aucie. Ciosy i strzały
korzystają z automatycznego celowania; F/Spację i przyciski dotykowe można
przytrzymać. Kliknięcie osoby wybiera cel i oddaje strzał.
