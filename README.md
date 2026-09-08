# gry-od-widzów

Strona z grami **Blue i Bingo — Wielka ucieczka**, **Klawiatura** oraz **I Am Polarity**.

Zagraj: https://mikolajczapski2016-dev.github.io/gry-od-widzow/

Pliki strony i gier znajdują się w `public/`. Każdy push do `main` publikuje stronę przez GitHub Pages.

Lokalny podgląd: `python3 -m http.server 8080 --directory public`, następnie otwórz http://localhost:8080.

Blue i Bingo to nieoficjalna gra fanowska. Informacje o ilustracjach i licencja Three.js znajdują się w katalogu gry.

I Am Polarity to autorski sandbox z widokiem z oczu magnetycznego bohatera.
Można chwytać i rzucać przedmiotami oraz postaciami, odpychać je mocą i strzelać
pistoletem. Animowani mieszkańcy reagują ucieczką i czasowym obezwładnieniem.
Zadania: recykling trzech skrzyń, przeniesienie pracownika do strefy ratunkowej
oraz dostarczenie dwóch ogniw do generatora. Po wykonaniu zadań zabawa trwa dalej.

Sterowanie: WASD/strzałki — ruch, przeciąganie myszą — rozglądanie,
E — chwyć/puść, F — rzuć/cios mocy, G — magnes/pistolet, klik — użyj,
R — przeładuj, Spacja — skok / wznieś się, V — lot, Shift — sprint, P/Escape — pauza.
Telefon: lewy joystick, przeciąganie po świecie i przyciski akcji po prawej.
Powrót do listy gier znajduje się w ustawieniach. Rekord, dźwięk i czułość
zapisują się lokalnie. Stary adres Miejskiego życia przekierowuje do nowej gry.

Postacie to modele szkieletowe Quaternius z oryginalnymi animacjami (CC0),
nie proceduralne figurki. Źródła: `public/i-am-polarity/assets/SOURCES.md`.
Three.js r160 oraz dodatki są przechowywane lokalnie; licencje MIT znajdują się
w katalogach `vendor` obu gier. Gra jest niezależnym projektem i nie jest
powiązana z twórcami I Am Cat ani I Am Monkey.

Mapa ma 136 × 136 jednostek: dodatkowe ulice, zabudowę i park.
Przycisk Lataj / Ląduj działa na komputerze i telefonie. W locie poruszaj się
w kierunku patrzenia, aby zmieniać wysokość; po wyłączeniu lotu opadasz na ziemię lub dach.

Mieszkańcy pojawiają się także w 24 sektorach poza centralnym placem.
Miejsca startowe są losowane spośród wolnych punktów, z dala od budynków i przedmiotów.

Misje ratunkowe wybierasz przyciskami „Napad na bank” i „Ratunek w parku”.
Strzałka i odległość prowadzą na miejsce. Napastnicy atakują po przybyciu bohatera;
obezwładnij ich mocami lub pistoletem i uratuj obie osoby. Po pokonaniu napastników
mieszkańcy idą do zielonej strefy; można też przenieść ich magnesem.
Nagrody: bank 800 pkt, park 600 pkt. Po porażce przycisk „Ponów” rozpoczyna nową próbę.

Przy obezwładnieniu postaci odtwarza się „Teletubisie mówią papa” z nagrania
wskazanego przez użytkownika (źródło w `public/i-am-polarity/assets/SOURCES.md`).
Efekt respektuje wyciszenie i zatrzymuje się po włączeniu pauzy.

Efekt pa-pa wczytuje się przed startem gry i pomija ciszę na początku nagrania.
Pokonana postać znika natychmiast i po 2 sekundach gry odradza się przy miejscu
startu bohatera, w wolnym punkcie. Pokonani napastnicy po odrodzeniu nie wracają
do walki; zaliczenie przeciwników i porażka po utracie zakładnika pozostają zapisane.
