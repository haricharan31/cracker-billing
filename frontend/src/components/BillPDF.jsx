import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer';

// No external font registration — use built-in PDF fonts only.
// ₹ is not in Helvetica's encoding; use "Rs." prefix throughout.

const C = {
  black: '#000000',
  mid:   '#444444',
  light: '#666666',
  line:  '#bbbbbb',
  headerBg: '#f0f0f0',
};

const B = 'Helvetica-Bold';
const N = 'Helvetica';

const styles = StyleSheet.create({
  page: {
    fontFamily: N,
    fontSize: 8.5,
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    color: C.black,
  },

  // ── Header ──────────────────────────────────────────────
  headerTop:   { textAlign: 'center', fontSize: 9,    fontFamily: B, marginBottom: 3 },
  headerTitle: { textAlign: 'center', fontSize: 13,   fontFamily: B, marginBottom: 8 },
  rule: { borderBottomWidth: 1, borderBottomColor: C.line, marginBottom: 6 },

  // ── Bill meta ────────────────────────────────────────────
  metaBlock: { marginBottom: 6 },
  metaRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  metaLabel: { color: C.light },
  metaValueB: { fontFamily: B },

  // ── Section header ───────────────────────────────────────
  sectionHeader: { fontFamily: B, fontSize: 9, marginTop: 8, marginBottom: 3 },

  // ── Borderless table wrapper (borders live on rows) ──────
  table: {
    marginBottom: 4,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: C.headerBg,
    borderTopWidth: 1,
    borderTopColor: C.black,
    borderBottomWidth: 1,
    borderBottomColor: C.black,
    borderLeftWidth: 1,
    borderLeftColor: C.black,
    borderRightWidth: 1,
    borderRightColor: C.black,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.black,
    borderLeftWidth: 1,
    borderLeftColor: C.black,
    borderRightWidth: 1,
    borderRightColor: C.black,
  },
  tableRowLast: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.black,
    borderLeftWidth: 1,
    borderLeftColor: C.black,
    borderRightWidth: 1,
    borderRightColor: C.black,
  },

  // ── Cell base ────────────────────────────────────────────
  cell: {
    paddingVertical: 3,
    paddingHorizontal: 3,
    borderRightWidth: 0.5,
    borderRightColor: C.black,
    fontSize: 8.5,
  },
  cellLast: {
    paddingVertical: 3,
    paddingHorizontal: 3,
    fontSize: 8.5,
  },
  thTxt: { fontFamily: B },

  // ── Column widths (percentage-based) ─────────────────────
  colNo:       { width: '4%' },
  colItem:     { width: '35%' },
  colItemOthers: { width: '30%' },
  colCases:    { width: '8%',  textAlign: 'right' },
  colBoxes:    { width: '8%',  textAlign: 'right' },
  colRate:     { width: '10%', textAlign: 'right' },
  colDisc:     { width: '8%',  textAlign: 'right' },
  colRateAD:   { width: '10%', textAlign: 'right' },
  colTotal:    { width: '17%', textAlign: 'right' },

  // ── Subtotal ─────────────────────────────────────────────
  subtotalRow:   { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 3, marginBottom: 2 },
  subtotalLabel: { fontFamily: B, fontSize: 9, marginRight: 6 },
  subtotalValue: { fontFamily: B, fontSize: 9, width: 64, textAlign: 'right' },

  // ── Summary ──────────────────────────────────────────────
  summarySection: { marginTop: 10, borderTopWidth: 1, borderTopColor: C.black, paddingTop: 6 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { color: C.mid, fontSize: 10 },
  summaryValue: { fontSize: 10 },
  grandTotalRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: C.line },
  grandTotalLabel: { fontFamily: B, fontSize: 11 },
  grandTotalValue: { fontFamily: B, fontSize: 11 },
  balanceRow:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  balanceLabel: { fontFamily: B, fontSize: 12 },
  balanceValue: { fontFamily: B, fontSize: 12 },

  // ── Seal Cases / RP boxes ────────────────────────────────────
  sealRpSection: { marginTop: 14, flexDirection: 'row' },
  sealRpBoxLeft: {
    flex: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 0,
    borderColor: C.black,
    padding: 8,
    minHeight: 44,
  },
  sealRpBoxRight: {
    flex: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.black,
    padding: 8,
    minHeight: 44,
  },
  sealRpLabel: { fontFamily: B, fontSize: 9, marginBottom: 5 },
  sealRpValue: { fontSize: 10 },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function rs(n) {
  return `Rs.${Number(n || 0).toFixed(2)}`;
}

function rsInt(n) {
  return `Rs.${Math.round(Number(n || 0))}`;
}

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

function num(v) { return Number(v || 0); }

// ── Table components ──────────────────────────────────────────────────────────

function TableHeader({ showCompany }) {
  const itemCol = showCompany ? styles.colItemOthers : styles.colItem;
  return (
    <View fixed style={styles.tableHead}>
      <Text style={[styles.cell, styles.thTxt, styles.colNo]}>#</Text>
      <Text style={[styles.cell, styles.thTxt, itemCol]}>
        {showCompany ? 'Item Name (Company)' : 'Item Name'}
      </Text>
      <Text style={[styles.cell, styles.thTxt, styles.colCases]}>Cases</Text>
      <Text style={[styles.cell, styles.thTxt, styles.colBoxes]}>Boxes</Text>
      <Text style={[styles.cell, styles.thTxt, styles.colRate]}>Rate/Box</Text>
      <Text style={[styles.cell, styles.thTxt, styles.colDisc]}>Disc%</Text>
      <Text style={[styles.cell, styles.thTxt, styles.colRateAD]}>Rate/Disc</Text>
      <Text style={[styles.cellLast, styles.thTxt, styles.colTotal]}>Total</Text>
    </View>
  );
}

function ItemRow({ item, showCompany, isLast }) {
  const cases         = num(item.cases);
  const boxes         = num(item.boxes);
  const rate          = num(item.rate_per_box);
  const disc          = num(item.discount_percent);
  const rateAfterDisc = rate * (1 + disc / 100);
  const total         = rateAfterDisc * boxes;

  const casesDisplay = cases >= 1 ? String(cases % 1 === 0 ? Math.round(cases) : cases) : '';
  const itemLabel    = showCompany && item.company_name
    ? `${item.item_name || ''} (${item.company_name})`
    : (item.item_name || '');

  const rowStyle  = isLast ? styles.tableRowLast : styles.tableRow;
  const itemCol   = showCompany ? styles.colItemOthers : styles.colItem;

  return (
    <View wrap={false} style={rowStyle}>
      <Text style={[styles.cell, styles.colNo]}>{item.serial_number ?? ''}</Text>
      <Text style={[styles.cell, itemCol]}>{itemLabel}</Text>
      <Text style={[styles.cell, styles.colCases]}>{casesDisplay}</Text>
      <Text style={[styles.cell, styles.colBoxes]}>{boxes > 0 ? boxes : ''}</Text>
      <Text style={[styles.cell, styles.colRate]}>{rate > 0 ? rate.toFixed(2) : ''}</Text>
      <Text style={[styles.cell, styles.colDisc]}>{disc.toFixed(0)}%</Text>
      <Text style={[styles.cell, styles.colRateAD]}>{rateAfterDisc > 0 ? rateAfterDisc.toFixed(2) : ''}</Text>
      <Text style={[styles.cellLast, styles.colTotal]}>{Number(total).toFixed(2)}</Text>
    </View>
  );
}

function ItemSection({ title, items, subtotal, showCompany }) {
  if (!items || items.length === 0) return null;
  return (
    <View minPresenceAhead={80}>
      <Text style={styles.sectionHeader}>{title}</Text>
      <View style={styles.table}>
        <TableHeader showCompany={showCompany} />
        {items.map((item, i) => (
          <ItemRow key={i} item={item} showCompany={showCompany} isLast={i === items.length - 1} />
        ))}
      </View>
      <View style={styles.subtotalRow}>
        <Text style={styles.subtotalLabel}>{title} Subtotal:</Text>
        <Text style={styles.subtotalValue}>{rs(subtotal)}</Text>
      </View>
    </View>
  );
}

// ── Main document export ──────────────────────────────────────────────────────

export function BillPDFDocument({ bill }) {
  const items     = Array.isArray(bill.items) ? bill.items : [];
  const standard  = items.filter(i => i.category === 'standard');
  const vadivel   = items.filter(i => i.category === 'vadivel');
  const sparklers = items.filter(i => i.category === 'sparklers');
  const guns      = items.filter(i => i.category === 'guns');
  const others    = items.filter(i => i.category === 'others');

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <Text style={styles.headerTop}>AMMA BHAGAWAN SHARANAM</Text>
        <Text style={styles.headerTitle}>LAXMI NARASIMHA TRADERS   JANGAON</Text>
        <View style={styles.rule} />

        {/* ── Bill meta ── */}
        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Text>
              <Text style={styles.metaLabel}>Bill No: </Text>
              <Text style={styles.metaValueB}>{bill.bill_number || ''}</Text>
            </Text>
            <Text>
              <Text style={styles.metaLabel}>Date: </Text>
              <Text style={styles.metaValueB}>{fmtDate(bill.bill_date)}</Text>
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text>
              <Text style={styles.metaLabel}>Customer Shop: </Text>
              <Text style={styles.metaValueB}>{bill.shop_name || ''}</Text>
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text>
              <Text style={styles.metaLabel}>Name: </Text>
              <Text style={styles.metaValueB}>{bill.customer_name || ''}</Text>
            </Text>
            {bill.phone ? (
              <Text>
                <Text style={styles.metaLabel}>Phone: </Text>
                <Text style={styles.metaValueB}>{bill.phone}</Text>
              </Text>
            ) : null}
          </View>
          {bill.location ? (
            <View style={styles.metaRow}>
              <Text>
                <Text style={styles.metaLabel}>Location: </Text>
                <Text style={styles.metaValueB}>{bill.location}</Text>
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rule} />

        {/* ── Item sections ── */}
        <ItemSection title="STANDARD FIREWORKS" items={standard}  subtotal={bill.standard_subtotal}  showCompany={false} />
        <ItemSection title="VADIVEL FIREWORKS"  items={vadivel}   subtotal={bill.vadivel_subtotal}   showCompany={false} />
        <ItemSection title="SPARKLERS"          items={sparklers} subtotal={bill.sparklers_subtotal} showCompany={false} />
        <ItemSection title="GUNS"               items={guns}      subtotal={bill.guns_subtotal}      showCompany={false} />
        <ItemSection title="OTHERS"             items={others}    subtotal={bill.others_subtotal}    showCompany={true}  />

        {/* ── Summary ── */}
        <View style={styles.summarySection}>
          {num(bill.standard_subtotal) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Standard Subtotal:</Text>
              <Text style={styles.summaryValue}>{rs(bill.standard_subtotal)}</Text>
            </View>
          )}
          {num(bill.vadivel_subtotal) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Vadivel Subtotal:</Text>
              <Text style={styles.summaryValue}>{rs(bill.vadivel_subtotal)}</Text>
            </View>
          )}
          {num(bill.sparklers_subtotal) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sparklers Subtotal:</Text>
              <Text style={styles.summaryValue}>{rs(bill.sparklers_subtotal)}</Text>
            </View>
          )}
          {num(bill.guns_subtotal) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Guns Subtotal:</Text>
              <Text style={styles.summaryValue}>{rs(bill.guns_subtotal)}</Text>
            </View>
          )}
          {num(bill.others_subtotal) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Others Subtotal:</Text>
              <Text style={styles.summaryValue}>{rs(bill.others_subtotal)}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Hamali:</Text>
            <Text style={styles.summaryValue}>{rs(bill.hamali_amount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Grand Total:</Text>
            <Text style={styles.grandTotalValue}>{rsInt(num(bill.grand_total) + num(bill.amount_paid_before))}</Text>
          </View>
          {num(bill.amount_paid_before) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {`Amount Paid Before Billing${bill.amount_paid_date ? ` (${fmtDate(bill.amount_paid_date)})` : ''}:`}
              </Text>
              <Text style={styles.summaryValue}>- {rs(bill.amount_paid_before)}</Text>
            </View>
          )}
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Balance Due:</Text>
            <Text style={styles.balanceValue}>{rsInt(bill.balance_due)}</Text>
          </View>
        </View>

        {/* ── Seal Cases / RP boxes ── */}
        <View style={styles.sealRpSection}>
          <View style={styles.sealRpBoxLeft}>
            <Text style={styles.sealRpLabel}>Total No. of Seal Cases:</Text>
            <Text style={styles.sealRpValue}>{num(bill.total_cases) > 0 ? String(num(bill.total_cases)) : ''}</Text>
          </View>
          <View style={styles.sealRpBoxRight}>
            <Text style={styles.sealRpLabel}>Total No. of RP:</Text>
            <Text style={styles.sealRpValue}>{bill.rp_count ? String(bill.rp_count) : ''}</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
