import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CornerOrnament, Flourish, Monogram } from '../components/Ornaments.js'
import { LanguageToggle } from '../components/LanguageToggle.js'
import { useI18n, useT } from '../i18n/index.js'

export function Rules() {
  const t = useT()
  const locale = useI18n((s) => s.locale)

  return (
    <div className="min-h-screen bg-ink relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-felt-noise opacity-90" />

      <CornerOrnament className="absolute top-5 left-5 w-10 h-10 text-brass/40" />
      <CornerOrnament className="absolute top-5 right-5 w-10 h-10 text-brass/40" style={{ transform: 'scaleX(-1)' } as React.CSSProperties} />

      <LanguageToggle className="absolute top-5 right-1/2 translate-x-1/2 lg:right-20 lg:translate-x-0 z-30" />

      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-center mb-8"
        >
          <Monogram size={48} />
          <div className="eyebrow text-brass mt-3">{t('rules.eyebrow')}</div>
          <h1 className="font-display text-cream text-5xl sm:text-6xl mt-2 leading-none">
            {t('rules.title')}
          </h1>
          <Flourish className="w-64 text-brass/40 mt-4" />
        </motion.div>

        <article className="plate p-6 sm:p-10 prose-rules">
          {locale === 'bg' ? <RulesBG /> : <RulesEN />}
        </article>

        <div className="text-center mt-8">
          <Link to="/" className="btn-ghost">{t('rules.backHome')}</Link>
        </div>

        <p className="text-center text-ash text-xs mt-6 italic">
          {t('rules.source')}
        </p>
      </main>
    </div>
  )
}

// ── Bulgarian content ────────────────────────────────────────────────
function RulesBG() {
  return (
    <>
      <Section title="1. Карти и места">
        <P>
          Играе се с <B>32-картово тесте</B>: ранговете <C>7, 8, 9, 10, J, Q, K, A</C>
          {' '}във всяка от четирите бои <C>♣ ♦ ♥ ♠</C>.
        </P>
        <P>
          Играят се <B>4 играча</B> в два отбора по двама. Партньорите седят един срещу
          друг — <C>Север-Юг</C> (места 1 и 3) срещу <C>Изток-Запад</C> (места 2 и 4).
        </P>
      </Section>

      <Section title="2. Раздаване">
        <P>
          Раздаването става в два кръга. Първо всеки получава <B>5 карти</B> — обикновено
          3 + 2. След това започва наддаването. Когато се избере договор, раздаващият дава
          още <B>3 карти</B> на всеки → 8 общо.
        </P>
        <P>
          Първи наддава играчът отдясно на раздаващия. При <C>4 паса</C> в първия кръг
          се раздава наново от следващия раздаващ.
        </P>
      </Section>

      <Section title="3. Договори (видове игра)">
        <Table headers={['Договор', 'Бой коз', 'Описание']} rows={[
          ['♣ Спатия', '♣', 'Стандартна козова игра'],
          ['♦ Каро', '♦', 'Стандартна козова игра'],
          ['♥ Купа', '♥', 'Стандартна козова игра'],
          ['♠ Пика', '♠', 'Стандартна козова игра'],
          ['Без коз (NT)', '—', 'Няма коз; точките се удвояват'],
          ['Всичко коз (AT)', 'всеки', 'Всеки цвят е коз, но никой не доминира'],
        ]} />
        <P>
          Силата на договорите във възходящ ред:{' '}
          <C>♣ &lt; ♦ &lt; ♥ &lt; ♠ &lt; Без коз &lt; Всичко коз</C>.
          Всеки следващ играч може да обяви по-висок договор или да пасува.
        </P>
        <P>
          <B>Контра</B> от противниковия отбор удвоява крайния резултат.{' '}
          <B>Реконтра</B> от наддаващия отбор го учетворява.
        </P>
        <P>
          Наддаването завършва когато <B>3 поредни паса</B> последват валиден договор.
        </P>
      </Section>

      <Section title="4. Стойности на картите">
        <Table headers={['Карта', 'При коз', 'Не-коз']} rows={[
          ['J', '20', '2'],
          ['9', '14', '0'],
          ['A', '11', '11'],
          ['10', '10', '10'],
          ['K', '4', '4'],
          ['Q', '3', '3'],
          ['8', '0', '0'],
          ['7', '0', '0'],
        ]} />
        <P>
          <B>Сила при коз:</B> J &gt; 9 &gt; A &gt; 10 &gt; K &gt; Q &gt; 8 &gt; 7
        </P>
        <P>
          <B>Сила при не-коз:</B> A &gt; 10 &gt; K &gt; Q &gt; J &gt; 9 &gt; 8 &gt; 7
        </P>
        <P>
          При <B>козова игра</B>: най-високият коз бие всичко; ако няма коз, най-високата
          карта от водещия цвят печели взятката.
        </P>
        <P>
          При <B>Всичко коз</B>: всяка боя използва козовите стойности и сила, но{' '}
          <B>никой цвят не доминира над друг</B>. Само карта от водещата боя може да вземе
          взятката — карта от друга боя автоматично е „празна".
        </P>
        <P>
          При <B>Без коз</B>: никой цвят не е коз; печели най-високата карта от водещата боя.
        </P>
      </Section>

      <Section title="5. Разиграване">
        <P>
          Първата взятка започва играчът отдясно на раздаващия. Победителят на всяка
          взятка извежда следващата.
        </P>
        <Bullets items={[
          'Трябва да отговориш на водещата боя ако имаш такава карта.',
          'При козова игра, ако не можеш да отговориш, си длъжен да цакаш с коз.',
          'Ако вече има изигран коз, си длъжен да надкозваш — освен ако партньорът ти не печели взятката.',
          'При „Без коз" никога не си длъжен да цакаш.',
          'При „Всичко коз" ако не можеш да отговориш — свободно изхвърляне (картата няма да вземе).',
        ]} />
      </Section>

      <Section title="6. Обявки (анонси)">
        <P>
          Обявките се правят при <B>изиграване на първата карта</B> в раздаването.{' '}
          <B>В „Без коз" обявки не са разрешени</B>, освен последно 10 и капо.
        </P>
        <Table headers={['Комбинация', 'Име', 'Точки']} rows={[
          ['3 поредни от една боя', 'Терца', '20'],
          ['4 поредни от една боя', 'Кварта', '50'],
          ['5+ поредни от една боя', 'Квинта', '100'],
          ['Четири 10/Q/K/A', 'Каре', '100'],
          ['Четири 9-ки', 'Каре от деветки', '150'],
          ['Четири валета (J)', 'Каре от валета', '200'],
          ['K+Q от козовата боя', 'Белот', '20'],
        ]} />
        <P>
          <B>Една карта не може да участва в две обявки.</B> Ако имаш{' '}
          <C>Q♠ K♠ A♠</C> + четирите дами — карето печели и поредицата отпада.
        </P>
        <P>
          <B>Сблъсък между двата отбора:</B>
        </P>
        <Bullets items={[
          'Карето бие всяка поредица.',
          'Между две карета — по-голямата точкова стойност печели.',
          'Между две поредици — по-дългата печели; при равна дължина — по-високата завършваща карта.',
          'Само обявките на печелившия отбор записват точки.',
        ]} />
        <P>
          <B>Белот</B> се записва когато играчът изиграе и <C>K</C>, и <C>Q</C> от
          козовия цвят — точките се присъждат при изиграване на втората от двете.
        </P>
      </Section>

      <Section title="7. Точкуване">
        <P>
          След изиграването на 8-те взятки точките се събират:
        </P>
        <Bullets items={[
          'Сума от стойностите на взетите карти.',
          '+10 за последната взятка.',
          '+90 за капо (всички 8 взятки от един отбор).',
          'Бонус точки от обявки (само на печелившия отбор).',
          'Белот +20 за играча, който го е завъртял.',
        ]} />
        <P>
          В <C>Без коз</C> точките от карти и обявки се <B>удвояват</B> — но бонусът за
          капо остава 90.
        </P>
      </Section>

      <Section title="8. Изкарана, вкарана, висяща">
        <P>
          Накрая на раздаването се сравняват сумите на двата отбора:
        </P>
        <Bullets items={[
          <><B>Изкарана</B> — наддаващият отбор има <B>повече</B> точки от противника. Всеки записва своите.</>,
          <><B>Вкарана</B> — наддаващият отбор има <B>по-малко</B>. Противниците записват всичко (картите + обявките + капо). Белот остава при играча, който го е завъртял.</>,
          <><B>Висяща</B> — точките са <B>равни</B>. Наддаващите записват 0; точките им „висят" и отиват на отбора, който спечели следващото раздаване. Натрупват се при поредни висящи.</>,
        ]} />
        <P>
          <B>Контра ×2, Реконтра ×4</B> умножават всичко, включително премията за капо
          (по подразбиране). Има опционално турнирно правило при което капо бонусът от
          90 остава фиксиран — настройва се от домакина в лобито.
        </P>
      </Section>

      <Section title="9. Резултат на мача">
        <P>
          Точките от ръката се <B>делят на 10</B> и закръгляват — това е стойността,
          която отива на таблото. Така стандартното раздаване дава ~16 точки (162 / 10).
        </P>
        <P>
          Мачът завършва когато един отбор стигне <C>151 точки</C>. Ако и двата
          прехвърлят прага в едно и също раздаване, печели по-високият. При равенство
          мачът продължава докато някой поведе.
        </P>
      </Section>

      <Section title="10. Спорни ситуации (FAQ)">
        <Q q="Какво става при 4 паса в първото наддаване?" a="Раздаването се прекратява и следващият раздаващ дава отново." />
        <Q q="Закъснял анонс — мога ли да обявя комбинация след изиграната първа карта?" a="Не. Анонсите се правят при изиграване на първата карта в раздаването. След това вече е невалиден." />
        <Q q="Имам каре дами и поредица Q-K-A от пика. Записвам ли двете?" a="Не. Картата Q♠ не може да брои в двете комбинации. Карето печели (по-стойностно) и поредицата отпада." />
        <Q
          q={'При „Всичко коз" хвърлих 9♠ и противникът хвърли J♥. Кой печели?'}
          a={'9♠ — водещата боя печели. В „Всичко коз" различен цвят не може да вземе взятка, защото никой цвят не доминира над друг.'}
        />
        <Q q="Партньорът ми вече печели взятката, а аз имам по-висок коз — трябва ли да надкозвам?" a="Не. Когато партньорът ти печели, не си длъжен да надкозваш — можеш да свалиш по-ниска карта." />
      </Section>
    </>
  )
}

// ── English content ──────────────────────────────────────────────────
function RulesEN() {
  return (
    <>
      <Section title="1. Cards and seats">
        <P>
          A standard <B>32-card deck</B> is used: ranks <C>7, 8, 9, 10, J, Q, K, A</C>
          {' '}in each of four suits <C>♣ ♦ ♥ ♠</C>.
        </P>
        <P>
          <B>4 players</B> in two teams of two. Partners sit opposite —{' '}
          <C>North-South</C> (seats 1 and 3) versus <C>East-West</C> (seats 2 and 4).
        </P>
      </Section>

      <Section title="2. The deal">
        <P>
          Two rounds. First, every player receives <B>5 cards</B> (typically 3 + 2).
          Bidding then begins. Once a contract is chosen, the dealer gives each player{' '}
          <B>3 more</B> cards → 8 total.
        </P>
        <P>
          The player to the right of the dealer bids first. <C>4 passes</C> in the first
          round → the next dealer reshuffles and re-deals.
        </P>
      </Section>

      <Section title="3. Contracts">
        <Table headers={['Contract', 'Trump suit', 'Notes']} rows={[
          ['♣ Clubs', '♣', 'Standard suit-trump game'],
          ['♦ Diamonds', '♦', 'Standard suit-trump game'],
          ['♥ Hearts', '♥', 'Standard suit-trump game'],
          ['♠ Spades', '♠', 'Standard suit-trump game'],
          ['No Trumps (NT)', '—', 'No trump; points doubled at scoring'],
          ['All Trumps (AT)', 'every suit', 'Every suit is trump but no suit dominates'],
        ]} />
        <P>
          Contract strength ascending:{' '}
          <C>♣ &lt; ♦ &lt; ♥ &lt; ♠ &lt; NT &lt; AT</C>.
          Each subsequent player may bid higher or pass.
        </P>
        <P>
          <B>Contra</B> by the defending team doubles the final result.{' '}
          <B>Re-contra</B> by the bidding team quadruples it.
        </P>
        <P>
          Bidding ends when <B>3 consecutive passes</B> follow a valid contract.
        </P>
      </Section>

      <Section title="4. Card values">
        <Table headers={['Card', 'Trump', 'Plain']} rows={[
          ['J', '20', '2'],
          ['9', '14', '0'],
          ['A', '11', '11'],
          ['10', '10', '10'],
          ['K', '4', '4'],
          ['Q', '3', '3'],
          ['8', '0', '0'],
          ['7', '0', '0'],
        ]} />
        <P>
          <B>Trump strength:</B> J &gt; 9 &gt; A &gt; 10 &gt; K &gt; Q &gt; 8 &gt; 7
        </P>
        <P>
          <B>Plain strength:</B> A &gt; 10 &gt; K &gt; Q &gt; J &gt; 9 &gt; 8 &gt; 7
        </P>
        <P>
          In a <B>suit-trump</B> game the highest trump always wins; if no trump was
          played, the highest card of the led suit takes the trick.
        </P>
        <P>
          In <B>All Trumps</B>: every suit uses trump values and strength, but{' '}
          <B>no suit dominates another</B>. Only a card of the led suit can take the
          trick — a card from another suit is automatically empty.
        </P>
        <P>
          In <B>No Trumps</B>: no suit is trump; the highest card of the led suit wins.
        </P>
      </Section>

      <Section title="5. Play">
        <P>
          The player to the right of the dealer leads the first trick. Whoever wins
          a trick leads the next.
        </P>
        <Bullets items={[
          'You must follow the led suit if you can.',
          'In suit-trump games, if you cannot follow, you must trump.',
          'If a trump has been played, you must over-trump if able — unless your partner is winning the trick.',
          'In No Trumps you are never required to trump.',
          'In All Trumps, if you cannot follow, you may discard freely (it cannot win).',
        ]} />
      </Section>

      <Section title="6. Announcements">
        <P>
          Announcements are declared when playing your <B>first card</B> of the hand.{' '}
          <B>No announcements are allowed in No Trumps</B>, except the last-trick +10
          and capot bonuses.
        </P>
        <Table headers={['Combination', 'Name', 'Points']} rows={[
          ['3 consecutive same suit', 'Terca', '20'],
          ['4 consecutive same suit', 'Kvarta', '50'],
          ['5+ consecutive same suit', 'Kvinta', '100'],
          ['Four 10/Q/K/A', 'Carré', '100'],
          ['Four 9s', 'Carré of nines', '150'],
          ['Four Jacks', 'Carré of jacks', '200'],
          ['K+Q of trump', 'Belot', '20'],
        ]} />
        <P>
          <B>A single card cannot count toward two announcements.</B> If you hold{' '}
          <C>Q♠ K♠ A♠</C> plus the four queens — the carré wins and the sequence drops.
        </P>
        <P>
          <B>Conflict between teams:</B>
        </P>
        <Bullets items={[
          'Any carré beats any sequence.',
          'Between two carrés — the higher point value wins.',
          'Between two sequences — the longer wins; same length → higher top card wins.',
          'Only the winning team scores its announcements; the loser forfeits theirs.',
        ]} />
        <P>
          <B>Belot</B> is scored when the same player plays both the <C>K</C> and
          {' '}<C>Q</C> of trump — the points are awarded on the second of the pair.
        </P>
      </Section>

      <Section title="7. Scoring">
        <P>
          After all 8 tricks, each team totals:
        </P>
        <Bullets items={[
          'Sum of card values from taken tricks.',
          '+10 for the last trick.',
          '+90 for capot (one team takes all 8 tricks).',
          'Announcement bonus (winning team only).',
          'Belot +20 to the holder of K+Q of trump.',
        ]} />
        <P>
          In <C>No Trumps</C>, card and announcement points are <B>doubled</B> — but
          the capot bonus stays at 90.
        </P>
      </Section>

      <Section title="8. Made / Inside / Suspended">
        <P>
          Compare the two teams' totals at the end of the hand:
        </P>
        <Bullets items={[
          <><B>Made</B> — bidding team has <B>more</B> points. Each team records its own.</>,
          <><B>Inside</B> — bidding team has <B>fewer</B>. Defenders take everything (cards + announcements + capot). Belot stays with its holder.</>,
          <><B>Suspended</B> — totals are <B>equal</B>. Bidders score 0; their points "hang" and go to whoever wins the next hand. Accumulates if hands keep ending suspended.</>,
        ]} />
        <P>
          <B>Contra ×2, Re-contra ×4</B> multiply everything including the capot bonus
          by default. There's an optional tournament variant where the +90 capot stays
          fixed — toggled by the host in the lobby.
        </P>
      </Section>

      <Section title="9. Match score">
        <P>
          A hand's points are <B>divided by 10</B> and rounded — that's what goes on
          the scoreboard. A typical hand thus yields ~16 points (162 / 10).
        </P>
        <P>
          The match ends when a team reaches <C>151 points</C>. If both teams cross
          151 in the same hand, the higher score wins. At a tie ≥151, play continues
          until one team leads.
        </P>
      </Section>

      <Section title="10. Disputed situations (FAQ)">
        <Q q="What happens after 4 passes in the first round of bidding?" a="The hand is aborted and the next dealer reshuffles and re-deals." />
        <Q q="Late announcement — can I declare a combination after my first card?" a="No. Announcements must be made when playing the first card of the hand. After that they're invalid." />
        <Q q="I have four queens and Q-K-A of spades. Do I get both?" a="No. Q♠ can't count in both combinations. The carré (worth more) wins and the sequence drops." />
        <Q q="In All Trumps I led 9♠ and the opponent played J♥. Who wins?" a="9♠ — the led suit wins. In All Trumps a different suit cannot take the trick because no suit dominates another." />
        <Q q="My partner is already winning the trick and I have a higher trump — must I over-trump?" a="No. When your partner is winning, you're not required to over-trump — you may play a lower card." />
      </Section>
    </>
  )
}

// ── Layout primitives (locale-agnostic) ─────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="font-display text-cream text-2xl sm:text-3xl mb-3 mt-2 first:mt-0">
        {title}
      </h2>
      <div className="rule-brass w-1/3 mb-4 opacity-70" />
      <div className="space-y-3 text-cream/85 text-[15px] sm:text-base leading-relaxed">
        {children}
      </div>
    </section>
  )
}
function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>
}
function B({ children }: { children: React.ReactNode }) {
  return <strong className="text-cream">{children}</strong>
}
function C({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-brass-hi text-[0.95em]">{children}</span>
}
function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc ml-5 space-y-1.5 marker:text-brass">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  )
}
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border border-brass/25 rounded">
        <thead>
          <tr className="bg-brass/10">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 font-display italic text-brass-hi border-b border-brass/25">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="odd:bg-ink/40">
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 border-b border-brass/10 last:border-0 text-cream/85">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
function Q({ q, a }: { q: string; a: string }) {
  return (
    <div className="border-l-2 border-brass/40 pl-4 py-1">
      <div className="font-display italic text-brass-hi mb-1">{q}</div>
      <div className="text-cream/85 text-sm">{a}</div>
    </div>
  )
}
