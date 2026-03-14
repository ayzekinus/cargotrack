import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { supabase, isConfigured } from "./supabase.js";

// Data is loaded from Supabase on mount
const INITIAL_CONTAINERS = [
  {
    id: "CNT-001",
    containerNo: "MSCU1234567",
    chassisNo: "CHS-044",
    musteri: "Arcelik A.S.",
    limanCikis: "2026-03-01",
    limanGiris: null,
    durum: "active",
    hareketler: [
      { tarih: "2026-03-01", surucu: "Mehmet Yılmaz", konum: "Ambarli Port → Esenyurt Warehouse", aciklama: "Picked up from port", km: 32 },
      { tarih: "2026-03-02", surucu: "Mehmet Yılmaz", konum: "Esenyurt Warehouse → Arcelik Factory", aciklama: "Delivered to customer", km: 48 },
      { tarih: "2026-03-05", surucu: "Ali Kaya", konum: "Arcelik Factory → Esenyurt Warehouse", aciklama: "Unloading complete", km: 48 },
    ],
  },
  {
    id: "CNT-002",
    containerNo: "CMAU9876543",
    chassisNo: "CHS-012",
    musteri: "Vestel Electronics",
    limanCikis: "2026-03-03",
    limanGiris: null,
    durum: "active",
    hareketler: [
      { tarih: "2026-03-03", surucu: "Hasan Demir", konum: "Haydarpasa Port → Manisa", aciklama: "Picked up from port", km: 310 },
    ],
  },
  {
    id: "CNT-003",
    containerNo: "HLXU4561239",
    chassisNo: "CHS-028",
    musteri: "Ford Otosan",
    limanCikis: "2026-02-20",
    limanGiris: "2026-03-04",
    durum: "closed",
    hareketler: [
      { tarih: "2026-02-20", surucu: "Mustafa Çelik", konum: "Gebze Port → Ford Factory", aciklama: "Picked up from port", km: 65 },
      { tarih: "2026-03-04", surucu: "Mustafa Çelik", konum: "Ford Factory → Gebze Port", aciklama: "Returned to port", km: 65 },
    ],
  },
];

const INITIAL_FORECAST = [
  { id: "FC-001", containerNo: "MAEU3456789", musteri: "Bosch Turkey", liman: "Ambarli", tahminiTarih: "2026-03-15", aciklama: "Equipment arriving from Germany", onem: "high" },
  { id: "FC-002", containerNo: "TCKU7654321", musteri: "Arcelik A.S.", liman: "Haydarpasa", tahminiTarih: "2026-03-18", aciklama: "Consumer electronics cargo", onem: "normal" },
];

const INITIAL_CHASSIS = [
  { id: "CH-001", chassisNo: "CHS-044", plakaNo: "34 ABC 044", tip: ["40FT"] },
  { id: "CH-002", chassisNo: "CHS-012", plakaNo: "34 DEF 012", tip: ["20FT"] },
  { id: "CH-003", chassisNo: "CHS-028", plakaNo: "34 GHJ 028", tip: ["45FT"] },
  { id: "CH-004", chassisNo: "CHS-007", plakaNo: "34 KLM 007", tip: ["20FT", "40FT"] },
  { id: "CH-005", chassisNo: "CHS-019", plakaNo: "34 NOP 019", tip: ["40FT"] },
];

const gunFarki = (baslangic, bitis) => {
  const b = new Date(baslangic);
  const s = bitis ? new Date(bitis) : new Date();
  return Math.ceil((s - b) / (1000 * 60 * 60 * 24));
};

const today = () => new Date().toISOString().split("T")[0];

const formatSuggestion = (item) => {
  const a = item.address || {};
  const parts = [
    a.road || a.neighbourhood || a.suburb,
    a.city || a.town || a.village || a.county,
    a.state,
    a.country_code?.toUpperCase(),
  ].filter(Boolean);
  return parts.join(", ");
};


const SuggestInput = ({ value, onChange, onSelect, field, placeholder, hasError, suggestions, sugLoading, activeSug, setActiveSug, setSuggestions, fetchSuggestions }) => (
  <div className="relative">
    <input
      className={`w-full border rounded-lg px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors placeholder:text-slate-300 ${hasError ? "border-red-400" : "border-slate-200"}`}
      placeholder={placeholder} value={value}
      onChange={e => { onChange(e.target.value); fetchSuggestions(e.target.value, field); setActiveSug(field); }}
      onFocus={() => { if (suggestions[field]?.length > 0) setActiveSug(field); }}
      onBlur={() => setTimeout(() => setActiveSug(null), 150)} />
    {sugLoading[field] && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">⏳</div>}
    {activeSug === field && suggestions[field]?.length > 0 && (
      <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-[999] max-h-56 overflow-y-auto mt-1">
        {suggestions[field].map((item, i) => (
          <div key={i} onMouseDown={() => { onSelect(item.display_name, formatSuggestion(item)); setSuggestions(p => ({ ...p, [field]: [] })); setActiveSug(null); }}
            className="px-4 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors">
            <div className="text-sm font-medium text-slate-700">
              {(() => { const a = item.address || {}; return a.road || a.neighbourhood || a.suburb || a.city || a.town || a.village || item.display_name.split(",")[0]; })()}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{formatSuggestion(item)}</div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default function App({ currentUser, onLogout }) {
  const [containers, setContainers] = useState([]);
  const [chassisList, setChassisList] = useState([]);
  const [forecastList, setForecastList] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [showAddContainer, setShowAddContainer] = useState(false);
  const [showAddHareket, setShowAddHareket] = useState(false);
  const [showKapatModal, setShowKapatModal] = useState(false);
  const [showAddChassis, setShowAddChassis] = useState(false);
  const [showAddForecast, setShowAddForecast] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDurum, setFilterDurum] = useState("all");
  const [hareketFilter, setHareketFilter] = useState({ containerNo: "", surucu: "", tarihBas: "", tarihBit: "" });
  const [forecastFilter, setForecastFilter] = useState({ containerNo: "", musteri: "", tarihBas: "", tarihBit: "" });
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, onConfirm }
  const [forecastPreview, setForecastPreview] = useState(null); // forecast item being previewed for "Container Aç"
  const [containerFormError, setContainerFormError] = useState("");

  const [newChassis, setNewChassis] = useState({ chassisNo: "", plakaNo: "", tip: [] });
  const [editChassis, setEditChassis] = useState(null);
  const [newForecast, setNewForecast] = useState({ containerNo: "", musteri: "", liman: "", tahminiTarih: today(), aciklama: "", onem: "normal", containerType: "20FT", kg: "", adr: false });
  const [successMessage, setSuccessMessage] = useState("");
  const [forecastPreviewError, setForecastPreviewError] = useState("");
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [kmLoading, setKmLoading] = useState(false);
  const [kmError, setKmError] = useState("");
  const [suggestions, setSuggestions] = useState({ addFrom: [], addTo: [], editFrom: [], editTo: [] });
  const [sugLoading, setSugLoading] = useState({ addFrom: false, addTo: false, editFrom: false, editTo: false });
  const [activeSug, setActiveSug] = useState(null); // "addFrom" | "addTo" | "editFrom" | "editTo"
  const debounceRef = useRef({});
  const [addErrors, setAddErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [newContainer, setNewContainer] = useState({
    containerNo: "", chassisNo: "", musteri: "", limanCikis: today(), containerType: "20FT", kg: "", adr: false,
  });
  const [newHareket, setNewHareket] = useState({
    tarih: today(), surucu: "", konum: "", konumFrom: "", konumTo: "", aciklama: "", km: "", kg: "", firma: "", referans: "", yukDurumu: "loaded", yukNotu: "", euronorm: "euro6",
  });
  const [surchargeLines, setSurchargeLines] = useState([]);
  const [newSurcharge, setNewSurcharge] = useState({ tip: "custom_stop", aciklama: "", tutar: "", saat: "", saatUcreti: "" });
  const [editHareketIdx, setEditHareketIdx] = useState(null);
  const [editHareket, setEditHareket] = useState(null);
  const [editSurchargeLines, setEditSurchargeLines] = useState([]);
  const [editNewSurcharge, setEditNewSurcharge] = useState({ tip: "custom_stop", aciklama: "", tutar: "", saat: "", saatUcreti: "" });

  // ── Supabase: fetch all data on mount ──────────────────────
  const fetchAll = useCallback(async () => {
    setDbLoading(true);
    setDbError("");
    try {
      const [contRes, chassisRes, fcRes, harRes] = await Promise.all([
        supabase.from("containers").select("*").order("id"),
        supabase.from("chassis").select("*").order("id"),
        supabase.from("forecast").select("*").order("tahmini_tarih"),
        supabase.from("hareketler").select("*").order("tarih").order("id"),
      ]);
      if (contRes.error) throw contRes.error;
      if (chassisRes.error) throw chassisRes.error;
      if (fcRes.error) throw fcRes.error;
      if (harRes.error) throw harRes.error;

      const harByContainer = {};
      (harRes.data || []).forEach(h => {
        if (!harByContainer[h.container_id]) harByContainer[h.container_id] = [];
        harByContainer[h.container_id].push({
          _id: h.id,
          tarih: h.tarih,
          surucu: h.surucu || "",
          konum: h.konum || "",
          aciklama: h.aciklama || "",
          km: h.km || "",
          firma: h.firma || "",
          referans: h.referans || "",
          yukDurumu: h.yuk_durumu || "loaded",
          yukNotu: h.yuk_notu || "",
          euronorm: h.euronorm || "euro6",
          kg: h.kg || "",
          surcharges: h.surcharges || [],
        });
      });

      setContainers((contRes.data || []).map(c => ({
        id: c.id,
        containerNo: c.container_no,
        chassisNo: c.chassis_no,
        musteri: c.musteri,
        limanCikis: c.liman_cikis,
        limanGiris: c.liman_giris || null,
        durum: c.durum,
        containerType: c.container_type || "20FT",
        kg: c.kg || "",
        adr: c.adr || false,
        hareketler: harByContainer[c.id] || [],
      })));

      setChassisList((chassisRes.data || []).map(ch => ({
        id: ch.id,
        chassisNo: ch.chassis_no,
        plakaNo: ch.plaka_no,
        tip: ch.tip || [],
      })));

      setForecastList((fcRes.data || []).map(fc => ({
        id: fc.id,
        containerNo: fc.container_no,
        musteri: fc.musteri,
        liman: fc.liman || "",
        tahminiTarih: fc.tahmini_tarih,
        aciklama: fc.aciklama || "",
        onem: fc.onem || "normal",
        containerType: fc.container_type || "20FT",
        kg: fc.kg || "",
        adr: fc.adr || false,
      })));
    } catch (err) {
      console.error("Supabase fetch error:", err);
      setDbError("Could not connect to database. Check your Supabase credentials in src/supabase.js");
    }
    setDbLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Supabase: helper to generate next ID ─────────────────
  const nextId = (prefix) => {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  };

  const SURCHARGE_TIPLERI = {
    custom_stop: { label: "🛑 Custom Stop", color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
    bekleme:     { label: "⏱ Waiting",      color: "#d97706", bg: "#fef3c7", border: "#fcd34d" },
    yakit:       { label: "⛽ Fuel Surcharge",     color: "#059669", bg: "#d1fae5", border: "#6ee7b7" },
    diger:       { label: "📎 Other",        color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd" },
  };

  const EMISSION_FACTORS = {
    euro6:    { label: "Euro 6",         factor: 0.055, color: "#059669", bg: "#d1fae5", border: "#6ee7b7" },
    euro5:    { label: "Euro 5",         factor: 0.062, color: "#d97706", bg: "#fef3c7", border: "#fcd34d" },
    euro4:    { label: "Euro 4",         factor: 0.080, color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
    full:     { label: "Full Load (40t)",factor: 0.047, color: "#1d6abf", bg: "#dbeafe", border: "#93c5fd" },
    half:     { label: "Half Load",      factor: 0.089, color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd" },
    ship:     { label: "Ship",           factor: 0.008, color: "#0891b2", bg: "#e0f2fe", border: "#7dd3fc" },
    train:    { label: "Train",          factor: 0.018, color: "#0d9488", bg: "#ccfbf1", border: "#5eead4" },
  };

  const calcCO2 = (km, kgStr, euronorm) => { // kgStr = movement-level kg
    const k = Number(km) || 0;
    const tons = (Number(kgStr) || 0) / 1000;
    const ef = EMISSION_FACTORS[euronorm] || EMISSION_FACTORS.euro6;
    if (k === 0 || tons === 0) return null;
    return Math.round(k * tons * ef.factor * 10) / 10; // kg CO2, 1 decimal
  };

  const co2Container = (c) => c.hareketler.reduce((sum, h) => {
    const v = calcCO2(h.km, h.kg || c.kg, h.euronorm || "euro6");
    return sum + (v || 0);
  }, 0);

  const co2AllActive = () => aktifler.reduce((s, c) => s + co2Container(c), 0);
  const co2AllTotal  = () => containers.reduce((s, c) => s + co2Container(c), 0);

    const surchargeToplamHareket = (h) => (h.surcharges || []).reduce((s, sc) => s + (Number(sc.tutar) || 0), 0);
  const surchargeToplamTumu = (hareketler) => hareketler.reduce((s, h) => s + surchargeToplamHareket(h), 0);
  const totalKm = (hareketler) => hareketler.reduce((s, h) => s + (Number(h.km) || 0), 0);

  const chassisWithDurum = chassisList.map(ch => ({
    ...ch,
    durum: containers.some(c => c.durum === "active" && c.chassisNo === ch.chassisNo) ? "in-use" : "available",
  }));

  const musaitChassis = chassisWithDurum.filter(ch => ch.durum === "available");

  const handleAddChassis = async () => {
    if (!newChassis.chassisNo || !newChassis.plakaNo || newChassis.tip.length === 0) return;
    const id = nextId("CH", chassisList);
    const { error } = await supabase.from("chassis").insert({
      id, chassis_no: newChassis.chassisNo, plaka_no: newChassis.plakaNo, tip: newChassis.tip,
    });
    if (error) { alert("Error saving chassis: " + error.message); return; }
    setChassisList(prev => [...prev, { ...newChassis, id }]);
    setNewChassis({ chassisNo: "", plakaNo: "", tip: [] });
    setShowAddChassis(false);
  };

  const handleDeleteChassis = (id, chassisNo) => {
    setConfirmDialog({
      title: "Delete Chassis",
      message: `Chassis "${chassisNo}" will be permanently deleted. This cannot be undone.`,
      onConfirm: async () => {
        const { error } = await supabase.from("chassis").delete().eq("id", id);
        if (error) { alert("Error deleting chassis: " + error.message); return; }
        setChassisList(prev => prev.filter(ch => ch.id !== id));
        setConfirmDialog(null);
      },
    });
  };

  const handleSaveEditChassis = async () => {
    if (!editChassis.chassisNo || !editChassis.plakaNo || (editChassis.tip || []).length === 0) return;
    const { error } = await supabase.from("chassis").update({
      chassis_no: editChassis.chassisNo, plaka_no: editChassis.plakaNo, tip: editChassis.tip,
    }).eq("id", editChassis.id);
    if (error) { alert("Error updating chassis: " + error.message); return; }
    setChassisList(prev => prev.map(ch => ch.id === editChassis.id ? { ...editChassis } : ch));
    setEditChassis(null);
  };

  const handleAddForecast = async () => {
    if (!newForecast.containerNo || !newForecast.musteri || !newForecast.tahminiTarih) return;
    const id = nextId("FC", forecastList);
    const { error } = await supabase.from("forecast").insert({
      id,
      container_no: newForecast.containerNo,
      musteri: newForecast.musteri,
      liman: newForecast.liman,
      tahmini_tarih: newForecast.tahminiTarih,
      aciklama: newForecast.aciklama,
      onem: newForecast.onem,
      container_type: newForecast.containerType,
      kg: newForecast.kg,
      adr: newForecast.adr,
    });
    if (error) { alert("Error saving forecast: " + error.message); return; }
    setForecastList(prev => [...prev, { ...newForecast, id }]);
    setNewForecast({ containerNo: "", musteri: "", liman: "", tahminiTarih: today(), aciklama: "", onem: "normal", containerType: "20FT", kg: "", adr: false });
    setShowAddForecast(false);
  };

  const handleForecastToContainer = (fc) => {
    setForecastPreview(fc);
  };

  const handleConfirmForecastToContainer = async () => {
    if (!forecastPreview) return;
    if (!forecastPreview.chassisNo) {
      setForecastPreviewError("Chassis selection is required.");
      return;
    }
    const id = nextId("CNT", containers);
    const limanCikis = forecastPreview.limanCikis || today();
    const newCont = {
      containerNo: forecastPreview.containerNo,
      chassisNo: forecastPreview.chassisNo,
      musteri: forecastPreview.musteri,
      limanCikis,
      containerType: forecastPreview.containerType || "20FT",
      kg: forecastPreview.kg || "",
      adr: forecastPreview.adr || false,
      id, limanGiris: null, durum: "active",
      hareketler: [],
    };
    const { error: cErr } = await supabase.from("containers").insert({
      id, container_no: newCont.containerNo, chassis_no: newCont.chassisNo,
      musteri: newCont.musteri, liman_cikis: limanCikis, durum: "active",
      container_type: newCont.containerType, kg: newCont.kg, adr: newCont.adr,
    });
    if (cErr) { alert("Error creating container: " + cErr.message); return; }
    const { data: hData, error: hErr } = await supabase.from("hareketler").insert({
      container_id: id, tarih: limanCikis, surucu: "-",
      konum: "Port → (Route not set)", aciklama: "Picked up from port",
    }).select().single();
    if (hErr) { alert("Error adding movement: " + hErr.message); return; }
    const { error: fErr } = await supabase.from("forecast").delete().eq("id", forecastPreview.id);
    if (fErr) console.error("Forecast delete error:", fErr);
    newCont.hareketler = [{ _id: hData?.id, tarih: limanCikis, surucu: "-", konum: "Port → (Route not set)", aciklama: "Picked up from port", surcharges: [] }];
    setContainers(prev => [...prev, newCont]);
    setForecastList(prev => prev.filter(f => f.id !== forecastPreview.id));
    setForecastPreview(null);
    setForecastPreviewError("");
    setSuccessMessage(`${forecastPreview.containerNo} was successfully processed and added to active containers.`);
    setActiveTab("dashboard");
    setTimeout(() => setSuccessMessage(""), 5000);
  };

  const handleDeleteForecast = (id, containerNo) => {
    setConfirmDialog({
      title: "Delete Forecast",
      message: `The forecast record for container "${containerNo}" will be permanently deleted.`,
      onConfirm: async () => {
        const { error } = await supabase.from("forecast").delete().eq("id", id);
        if (error) { alert("Error deleting forecast: " + error.message); return; }
        setForecastList(prev => prev.filter(f => f.id !== id));
        setConfirmDialog(null);
      },
    });
  };

  const aktifler = containers.filter(c => c.durum === "active");
  const kapalilar = containers.filter(c => c.durum === "closed");

  const filteredContainers = useMemo(() => {
    return containers.filter(c => {
      const matchSearch =
        c.containerNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.musteri.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.chassisNo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDurum = filterDurum === "all" || c.durum === filterDurum;
      return matchSearch && matchDurum;
    });
  }, [containers, searchTerm, filterDurum]);

  const filteredForecast = useMemo(() => {
    return [...forecastList].filter(fc => {
      const fCno = forecastFilter.containerNo.toLowerCase();
      const fMusteri = forecastFilter.musteri.toLowerCase();
      return (!fCno || fc.containerNo.toLowerCase().includes(fCno))
        && (!fMusteri || fc.musteri.toLowerCase().includes(fMusteri))
        && (!forecastFilter.tarihBas || fc.tahminiTarih >= forecastFilter.tarihBas)
        && (!forecastFilter.tarihBit || fc.tahminiTarih <= forecastFilter.tarihBit);
    }).sort((a, b) => new Date(a.tahminiTarih) - new Date(b.tahminiTarih));
  }, [forecastList, forecastFilter]);

  const allHareketler = useMemo(() => {
    return containers.flatMap(c => c.hareketler.map(h => ({
      ...h, containerNo: c.containerNo, musteri: c.musteri, containerId: c.id,
    }))).sort((a, b) => new Date(b.tarih) - new Date(a.tarih));
  }, [containers]);

  const filteredHareketler = useMemo(() => {
    return allHareketler.filter(h => {
      const fCno = hareketFilter.containerNo.toLowerCase();
      const fSurucu = hareketFilter.surucu.toLowerCase();
      return (!fCno || h.containerNo.toLowerCase().includes(fCno) || h.musteri.toLowerCase().includes(fCno))
        && (!fSurucu || (h.surucu || "").toLowerCase().includes(fSurucu))
        && (!hareketFilter.tarihBas || h.tarih >= hareketFilter.tarihBas)
        && (!hareketFilter.tarihBit || h.tarih <= hareketFilter.tarihBit);
    });
  }, [allHareketler, hareketFilter]);

  // ── KM Auto-Calculate (Nominatim + OSRM) ────────────────────
  const calculateKm = async (fromStr, toStr, setter) => {
    if (!fromStr || !toStr) {
      setKmError("Please enter both departure and destination.");
      return;
    }
    setKmLoading(true);
    setKmError("");
    try {
      const geocode = async (place) => {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        if (!data || data.length === 0) throw new Error(`Location not found: "${place}"`);
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      };
      const [start, end] = await Promise.all([geocode(fromStr), geocode(toStr)]);
      const routeRes = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false`
      );
      const routeData = await routeRes.json();
      if (routeData.code !== "Ok" || !routeData.routes || routeData.routes.length === 0) {
        throw new Error("Could not calculate route between these locations.");
      }
      const km = Math.round(routeData.routes[0].distance / 1000);
      setter(km);
    } catch (err) {
      setKmError(err.message || "KM calculation failed.");
    }
    setKmLoading(false);
  };

  const fetchSuggestions = useCallback((query, field) => {
    if (!query || query.length < 2) { setSuggestions(p => ({ ...p, [field]: [] })); return; }
    if (debounceRef.current[field]) clearTimeout(debounceRef.current[field]);
    debounceRef.current[field] = setTimeout(async () => {
      setSugLoading(p => ({ ...p, [field]: true }));
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`,
          { headers: { "Accept-Language": "en", "User-Agent": "CargoTrack/1.0" } }
        );
        const data = await res.json();
        setSuggestions(p => ({ ...p, [field]: data || [] }));
      } catch {
        setSuggestions(p => ({ ...p, [field]: [] }));
      }
      setSugLoading(p => ({ ...p, [field]: false }));
    }, 400);
  }, []);

  const downloadCSV = (rows, headers, filename) => {
    const bom = "\uFEFF";
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportHareketlerCSV = () => {
    const headers = ["Date","Container No","Customer","Driver","Location/Route","KM","Euro Norm","CO2 (kg)","Company","Reference","Load Status","Surcharge (TL)","Load Note"];
    const rows = filteredHareketler.map(h => [
      h.tarih, h.containerNo, h.musteri, h.surucu || "", h.konum || "",
      h.km || 0,
      h.euronorm || "euro6",
      (() => { const cont = containers.find(c => c.containerNo === h.containerNo); return calcCO2(h.km, h.kg || cont?.kg, h.euronorm) || 0; })(),
      h.firma || "", h.referans || "",
      h.yukDurumu || "loaded",
      (h.surcharges || []).reduce((s, sc) => s + (Number(sc.tutar) || 0), 0),
      h.yukNotu || "",
    ]);
    downloadCSV(rows, headers, `hareketler_${today()}.csv`);
  };

  const exportContainersCSV = () => {
    const headers = ["Container ID","Container No","Chassis No","Customer","Port Departure","Port Return","Status","Total Days","Total KM","Movement Count","Total Surcharge (TL)"];
    const rows = filteredContainers.map(c => [
      c.id, c.containerNo, c.chassisNo, c.musteri, c.limanCikis, c.limanGiris || "",
      c.durum, gunFarki(c.limanCikis, c.limanGiris),
      totalKm(c.hareketler), c.hareketler.length,
      surchargeToplamTumu(c.hareketler),
    ]);
    downloadCSV(rows, headers, `containerlar_${today()}.csv`);
  };

  const exportPDF = (type) => {
    const w = window.open("", "_blank");
    const style = `<style>body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;padding:20px}h2{font-size:15px;color:#1d6abf;margin-bottom:4px}p{color:#64748b;font-size:10px;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#f1f5f9;color:#475569;font-size:9px;text-transform:uppercase;letter-spacing:1px;padding:7px 10px;border:1px solid #e2e8f0;text-align:left}td{padding:7px 10px;border:1px solid #e2e8f0;font-size:10px}tr:nth-child(even) td{background:#f8fafc}.badge{padding:2px 8px;border-radius:2px;font-weight:700;font-size:9px}.aktif{background:#d1fae5;color:#059669}.kapali{background:#f1f5f9;color:#94a3b8}@media print{body{padding:0}</style>`;
    if (type === "hareketler") {
      const rows = filteredHareketler.map(h => {
        const ek = (h.surcharges || []).reduce((s, sc) => s + (Number(sc.tutar) || 0), 0);
        return `<tr><td>${h.tarih}</td><td style="color:#1d6abf;font-weight:700">${h.containerNo}</td><td>${h.musteri}</td><td>${h.surucu || ""}</td><td style="color:#64748b">${h.konum || ""}</td><td style="text-align:right">${h.km ? Number(h.km).toLocaleString("en-US") + " km" : "—"}</td><td>${h.firma || ""}</td><td>${h.referans || ""}</td><td>${h.yukDurumu || ""}</td><td style="text-align:right;color:#dc2626;font-weight:700">${ek > 0 ? ek.toLocaleString("en-US") + " ₺" : "—"}</td></tr>`;
      }).join("");
      w.document.write(`<!DOCTYPE html><html><head><title>Movement Report</title>${style}</head><body><h2>Movement Records Report</h2><p>Tarih: ${today()} — Toplam ${filteredHareketler.length} records</p><table><thead><tr><th>Date</th><th>Container No</th><th>Customer</th><th>Driver</th><th>Location/Route</th><th>KM</th><th>Company</th><th>Reference</th><th>Load</th><th>Surcharge</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    } else {
      const rows = filteredContainers.map(c => {
        const ek = surchargeToplamTumu(c.hareketler);
        return `<tr><td style="color:#1d6abf;font-weight:700">${c.containerNo}</td><td>${c.chassisNo}</td><td>${c.musteri}</td><td>${c.limanCikis}</td><td>${c.limanGiris || "—"}</td><td><span class="badge ${c.durum}">${c.durum === "active" ? "Active" : "Closed"}</span></td><td style="text-align:right">${gunFarki(c.limanCikis, c.limanGiris)} gün</td><td style="text-align:right">${totalKm(c.hareketler).toLocaleString("en-US")} km</td><td style="text-align:right">${c.hareketler.length}</td><td style="text-align:right;color:#dc2626;font-weight:700">${ek > 0 ? ek.toLocaleString("en-US") + " ₺" : "—"}</td></tr>`;
      }).join("");
      w.document.write(`<!DOCTYPE html><html><head><title>Container Report</title>${style}</head><body><h2>Container List Report</h2><p>Tarih: ${today()} — Toplam ${filteredContainers.length} container</p><table><thead><tr><th>Container No</th><th>Chassis</th><th>Customer</th><th>Departure</th><th>Return</th><th>Status</th><th>Days</th><th>Total KM</th><th>Movements</th><th>Surcharge</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    }
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  const handleAddContainer = async () => {
    if (!newContainer.containerNo || !newContainer.musteri) return;
    if (!newContainer.chassisNo) {
      setContainerFormError("Chassis selection is required.");
      return;
    }
    const id = nextId("CNT", containers);
    const { error: cErr } = await supabase.from("containers").insert({
      id,
      container_no: newContainer.containerNo,
      chassis_no: newContainer.chassisNo,
      musteri: newContainer.musteri,
      liman_cikis: newContainer.limanCikis,
      durum: "active",
      container_type: newContainer.containerType,
      kg: newContainer.kg,
      adr: newContainer.adr,
    });
    if (cErr) { alert("Error saving container: " + cErr.message); return; }
    const { data: hData, error: hErr } = await supabase.from("hareketler").insert({
      container_id: id,
      tarih: newContainer.limanCikis,
      surucu: "-",
      konum: "Port → (Route not set)",
      aciklama: "Picked up from port",
    }).select().single();
    if (hErr) { alert("Error adding initial movement: " + hErr.message); return; }
    setContainers(prev => [...prev, {
      ...newContainer, id, limanGiris: null, durum: "active",
      hareketler: [{ _id: hData?.id, tarih: newContainer.limanCikis, surucu: "-", konum: "Port → (Route not set)", aciklama: "Picked up from port", surcharges: [] }],
    }]);
    setNewContainer({ containerNo: "", chassisNo: "", musteri: "", limanCikis: today(), containerType: "20FT", kg: "", adr: false });
    setContainerFormError("");
    setShowAddContainer(false);
  };

  const handleAddHareket = async () => {
    const errs = {};
    if (!newHareket.surucu) errs.surucu = "Driver is required.";
    if (!newHareket.konum) errs.konum = "Location / Route is required.";
    if (!newHareket.kg || Number(newHareket.kg) <= 0) errs.kg = "Weight (KG) is required for CO₂ calculation.";
    if (Object.keys(errs).length > 0) { setAddErrors(errs); return; }
    setAddErrors({});
    const { data: hData, error } = await supabase.from("hareketler").insert({
      container_id: selectedContainer.id,
      tarih: newHareket.tarih,
      surucu: newHareket.surucu,
      konum: newHareket.konum,
      aciklama: newHareket.aciklama,
      km: newHareket.km ? Number(newHareket.km) : 0,
      firma: newHareket.firma,
      referans: newHareket.referans,
      yuk_durumu: newHareket.yukDurumu,
      yuk_notu: newHareket.yukNotu,
      euronorm: newHareket.euronorm || "euro6",
      kg: newHareket.kg ? Number(newHareket.kg) : null,
      surcharges: surchargeLines,
    }).select().single();
    if (error) { alert("Error saving movement: " + error.message); return; }
    const hareketWithSurcharges = { ...newHareket, _id: hData?.id, surcharges: surchargeLines };
    setContainers(prev => prev.map(c =>
      c.id === selectedContainer.id
        ? { ...c, hareketler: [...c.hareketler, hareketWithSurcharges] }
        : c
    ));
    setSelectedContainer(prev => ({ ...prev, hareketler: [...prev.hareketler, hareketWithSurcharges] }));
    setNewHareket({ tarih: today(), surucu: "", konum: "", konumFrom: "", konumTo: "", aciklama: "", km: "", kg: "", firma: "", referans: "", yukDurumu: "loaded", yukNotu: "", euronorm: "euro6" });
    setSurchargeLines([]);
    setNewSurcharge({ tip: "custom_stop", aciklama: "", tutar: "", saat: "", saatUcreti: "" });
    setShowAddHareket(false);
  };

  const handleSaveEditHareket = async () => {
    const errs = {};
    if (!editHareket.surucu) errs.surucu = "Driver is required.";
    if (!editHareket.konum) errs.konum = "Location / Route is required.";
    if (!editHareket.kg || Number(editHareket.kg) <= 0) errs.kg = "Weight (KG) is required for CO₂ calculation.";
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return; }
    setEditErrors({});
    const updated = { ...editHareket, surcharges: editSurchargeLines };
    if (editHareket._id) {
      const { error } = await supabase.from("hareketler").update({
        tarih: editHareket.tarih,
        surucu: editHareket.surucu,
        konum: editHareket.konum,
        aciklama: editHareket.aciklama,
        km: editHareket.km ? Number(editHareket.km) : 0,
        firma: editHareket.firma,
        referans: editHareket.referans,
        yuk_durumu: editHareket.yukDurumu,
        yuk_notu: editHareket.yukNotu,
        euronorm: editHareket.euronorm || "euro6",
        kg: editHareket.kg ? Number(editHareket.kg) : null,
        surcharges: editSurchargeLines,
      }).eq("id", editHareket._id);
      if (error) { alert("Error updating movement: " + error.message); return; }
    }
    setContainers(prev => prev.map(c =>
      c.id === selectedContainer.id
        ? { ...c, hareketler: c.hareketler.map((h, i) => i === editHareketIdx ? updated : h) }
        : c
    ));
    setSelectedContainer(prev => ({ ...prev, hareketler: prev.hareketler.map((h, i) => i === editHareketIdx ? updated : h) }));
    setEditHareketIdx(null);
    setEditHareket(null);
    setEditSurchargeLines([]);
  };

  // ✅ EKSİK FONKSİYON — düzeltildi
  const handleKapat = async (limanGirisTarihi) => {
    const { error: cErr } = await supabase.from("containers").update({
      durum: "closed", liman_giris: limanGirisTarihi,
    }).eq("id", selectedContainer.id);
    if (cErr) { alert("Error closing container: " + cErr.message); return; }
    await supabase.from("hareketler").insert({
      container_id: selectedContainer.id,
      tarih: limanGirisTarihi,
      surucu: "-",
      konum: "→ Port Return",
      aciklama: "Returned to port — operation closed",
    });
    setContainers(prev => prev.map(c =>
      c.id === selectedContainer.id
        ? {
            ...c,
            durum: "closed",
            limanGiris: limanGirisTarihi,
            hareketler: [...c.hareketler, { tarih: limanGirisTarihi, surucu: "-", konum: "→ Port Return", aciklama: "Returned to port — operation closed", surcharges: [] }],
          }
        : c
    ));
    setSelectedContainer(null);
    setShowKapatModal(false);
    setActiveTab("liste");
  };
  // Supabase config check
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
          <div className="text-5xl mb-4">⬡</div>
          <div className="text-white font-black text-3xl tracking-widest mb-1">CARGO<span className="text-blue-400">TRACK</span></div>
          <div className="text-slate-500 text-xs tracking-widest mb-8 uppercase">Container Planning System</div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 mb-7 text-left">
            <div className="text-amber-400 font-bold text-sm mb-3">⚠ Supabase Configuration Required</div>
            <div className="text-slate-400 text-xs leading-relaxed">
              Open <code className="bg-white/10 px-1.5 py-0.5 rounded text-slate-200">src/supabase.js</code> and fill in:
              <div className="mt-3 bg-black/30 rounded-lg p-3 font-mono text-xs text-emerald-400">
                <div>{"const SUPABASE_URL = "}<span className="text-amber-300">"https://xxxx.supabase.co"</span>{";"}</div>
                <div className="mt-1">{"const SUPABASE_ANON_KEY = "}<span className="text-amber-300">"eyJhbGci..."</span>{";"}</div>
              </div>
              <div className="mt-3 text-slate-500 text-xs">Get these from <strong className="text-slate-400">supabase.com → Settings → API</strong>. See SUPABASE-SETUP.md for the full guide.</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <a href="https://supabase.com" target="_blank" rel="noreferrer" className="bg-blue-600 text-white text-xs font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors block">1. Open Supabase →</a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="bg-white/8 text-slate-400 border border-white/10 text-xs font-bold py-3 rounded-lg hover:bg-white/12 transition-colors block">2. Update Code</a>
          </div>
        </div>
      </div>
    );
  }

  const NAV = [
    { key: "dashboard", icon: "⊞", label: "Dashboard" },
    { key: "forecast",  icon: "◈", label: "Forecast" },
    { key: "liste",     icon: "▦", label: "Containers" },
    { key: "hareketler",icon: "⊳", label: "Movements" },
    { key: "ayarlar",   icon: "⊙", label: "Settings" },
  ];

  const PAGE_TITLE = { dashboard: "Dashboard", forecast: "Forecast", liste: "Containers", hareketler: "Movements", ayarlar: "Settings", detay: selectedContainer ? selectedContainer.containerNo : "Detail" };

  const INP = "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors placeholder:text-slate-300";
  const LBL = "block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5";
  const BTN_P = "bg-blue-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-blue-700 active:scale-95 transition-all";
  const BTN_G = "border border-slate-200 text-slate-600 bg-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors";
  const BTN_D = "bg-red-50 text-red-600 border border-red-200 text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-red-100 transition-colors";
  const BTN_S = "bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-emerald-100 transition-colors";

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      {/* ── SIDEBAR ──────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-[#1e293b] flex flex-col z-40 transition-transform duration-300 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700/50">
          <span className="text-blue-400 text-2xl leading-none">⬡</span>
          <div>
            <div className="text-white font-black tracking-widest text-sm uppercase">CARGO<span className="text-blue-400">TRACK</span></div>
            <div className="text-slate-500 text-[9px] tracking-widest uppercase mt-0.5">Container Planning</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(n => (
            <button key={n.key}
              onClick={() => { setActiveTab(n.key); setSelectedContainer(null); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${activeTab === n.key || (n.key === "detay" && activeTab === "detay") ? "bg-blue-600 text-white shadow-md shadow-blue-900/30" : "text-slate-400 hover:text-white hover:bg-slate-700/50"}`}>
              <span className="text-base w-5 text-center">{n.icon}</span>
              <span>{n.label}</span>
              {(n.key === "forecast" && forecastList.length > 0) && <span className="ml-auto bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{forecastList.length}</span>}
            </button>
          ))}
        </nav>

        {/* User */}
        {currentUser && (
          <div className="px-4 py-4 border-t border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-semibold truncate">{currentUser.name}</div>
                <div className="text-slate-500 text-[10px] capitalize">{currentUser.role}</div>
              </div>
              <button onClick={onLogout} title="Sign Out"
                className="text-slate-500 hover:text-white text-sm transition-colors">→</button>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* ── MAIN ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:ml-64 min-h-screen overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20 flex-shrink-0">
          <div className="flex items-center justify-between px-4 md:px-6 h-14">
            {/* Mobile hamburger */}
            <button className="md:hidden text-slate-500 hover:text-slate-800 text-xl mr-3" onClick={() => setMobileMenuOpen(true)}>☰</button>
            {/* Page title */}
            <div>
              <h1 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{PAGE_TITLE[activeTab] || "Detail"}</h1>
            </div>
            {/* Actions */}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setShowAddContainer(true)}
                className="bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5">
                <span className="text-base leading-none">+</span>
                <span className="hidden sm:inline">New Container</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">

          {/* DB LOADING */}
          {dbLoading && (
            <div className="fixed inset-0 bg-white/90 z-50 flex flex-col items-center justify-center">
              <div className="text-5xl mb-4 animate-spin text-blue-500">⬡</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading data...</div>
            </div>
          )}

          {/* DB ERROR */}
          {dbError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-red-500 text-lg">⚠</span>
                <div>
                  <div className="text-red-700 text-sm font-semibold">Database Connection Error</div>
                  <div className="text-red-500 text-xs mt-0.5">{dbError}</div>
                </div>
              </div>
              <button onClick={fetchAll} className="bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-700">Retry</button>
            </div>
          )}

          {/* SUCCESS BANNER */}
          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3.5 mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-emerald-500 text-lg">✓</span>
                <span className="text-emerald-700 text-sm font-medium">{successMessage}</span>
              </div>
              <button onClick={() => setSuccessMessage("")} className="text-emerald-500 hover:text-emerald-700 text-lg">×</button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* DASHBOARD TAB                                         */}
          {/* ══════════════════════════════════════════════════════ */}
          {activeTab === "dashboard" && (
            <div>
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Active Containers", value: aktifler.length, color: "#2563eb", sub: "In operation" },
                  { label: "Completed", value: kapalilar.length, color: "#059669", sub: "This period" },
                  { label: "Total Active Days", value: aktifler.reduce((s, c) => s + gunFarki(c.limanCikis, null), 0), color: "#d97706", sub: "Sum of durations" },
                  { label: "Forecast", value: forecastList.length, color: "#7c3aed", sub: "Upcoming" },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-5">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{s.label}</div>
                    <div className="text-3xl font-black mt-1.5" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-xs text-slate-400 mt-1">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Carbon widget */}
              {co2AllTotal() > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "🌍 Fleet CO₂", value: `${(co2AllTotal() / 1000).toFixed(2)} t`, sub: `${co2AllTotal().toFixed(1)} kg total`, color: "#059669" },
                    { label: "⚡ Active CO₂", value: `${(co2AllActive() / 1000).toFixed(2)} t`, sub: `${aktifler.length} containers`, color: "#d97706" },
                    { label: "🌳 Tree Equiv.", value: Math.round(co2AllTotal() / 21), sub: "trees/year to offset", color: "#047857" },
                    { label: "💶 Carbon Cost", value: `€${Math.round(co2AllTotal() / 1000 * 18)}`, sub: "~€18/ton estimate", color: "#7c3aed" },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-5" style={{ borderLeft: `3px solid ${s.color}` }}>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{s.label}</div>
                      <div className="text-2xl font-black mt-1.5" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-xs text-slate-400 mt-1">{s.sub}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Active containers table */}
              <div className="bg-white rounded-xl border border-slate-100 mb-6">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Active Containers</h2>
                  <span className="text-xs text-slate-400">{aktifler.length} active</span>
                </div>
                {aktifler.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">No active containers</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          {["Container No","Chassis","Customer","Departure","Days","Last Location",""].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {aktifler.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 cursor-pointer"
                            onClick={() => { setSelectedContainer(c); setActiveTab("detay"); }}>
                            <td className="px-5 py-3.5 text-sm font-semibold text-blue-600">{c.containerNo}</td>
                            <td className="px-5 py-3.5 text-sm text-slate-500">{c.chassisNo}</td>
                            <td className="px-5 py-3.5 text-sm text-slate-700 font-medium">{c.musteri}</td>
                            <td className="px-5 py-3.5 text-xs text-slate-400">{c.limanCikis}</td>
                            <td className="px-5 py-3.5">
                              <span className={`text-sm font-black ${gunFarki(c.limanCikis) > 14 ? "text-red-500" : "text-amber-500"}`}>{gunFarki(c.limanCikis)}</span>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-slate-400 max-w-xs truncate">{c.hareketler[c.hareketler.length - 1]?.konum?.split("→").pop()?.trim() || "—"}</td>
                            <td className="px-5 py-3.5">
                              <button className="text-xs text-blue-500 hover:text-blue-700 font-semibold whitespace-nowrap"
                                onClick={e => { e.stopPropagation(); setSelectedContainer(c); setActiveTab("detay"); }}>Detail →</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Upcoming forecast */}
              {forecastList.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Upcoming Containers</h2>
                    <button className="text-xs text-blue-500 hover:text-blue-700 font-semibold" onClick={() => setActiveTab("forecast")}>View All →</button>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {[...forecastList].sort((a,b) => new Date(a.tahminiTarih) - new Date(b.tahminiTarih)).slice(0,3).map(fc => {
                      const gk = gunFarki(today(), fc.tahminiTarih);
                      const gecti = new Date(fc.tahminiTarih) < new Date();
                      return (
                        <div key={fc.id} className="flex items-center justify-between px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${fc.onem === "high" ? "bg-red-500" : fc.onem === "urgent" ? "bg-purple-500" : "bg-blue-400"}`} />
                            <div>
                              <span className="text-sm font-semibold text-blue-600">{fc.containerNo}</span>
                              <span className="text-xs text-slate-400 ml-2">{fc.musteri}</span>
                            </div>
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${gecti ? "bg-red-50 text-red-600" : gk <= 3 ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}>
                            {gecti ? `${Math.abs(gk)}d overdue` : gk === 0 ? "Today" : `${gk}d left`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {forecastList.length === 0 && (
                <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
                  <div className="text-4xl text-slate-200 mb-3">◈</div>
                  <div className="text-sm text-slate-400 mb-4">No upcoming containers</div>
                  <button className={BTN_P} onClick={() => setActiveTab("forecast")}>+ Add Forecast</button>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* FORECAST TAB                                          */}
          {/* ══════════════════════════════════════════════════════ */}
          {activeTab === "forecast" && (
            <div>
              {/* Filter bar */}
              <div className="bg-white rounded-xl border border-slate-100 p-4 mb-5 flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-36">
                  <label className={LBL}>Container No</label>
                  <input className={INP} placeholder="Filter..." value={forecastFilter.containerNo} onChange={e => setForecastFilter(p => ({...p, containerNo: e.target.value}))} />
                </div>
                <div className="flex-1 min-w-36">
                  <label className={LBL}>Customer</label>
                  <input className={INP} placeholder="Customer name..." value={forecastFilter.musteri} onChange={e => setForecastFilter(p => ({...p, musteri: e.target.value}))} />
                </div>
                <div className="flex-1 min-w-32">
                  <label className={LBL}>Est. Date From</label>
                  <input type="date" className={INP} value={forecastFilter.tarihBas} onChange={e => setForecastFilter(p => ({...p, tarihBas: e.target.value}))} />
                </div>
                <div className="flex-1 min-w-32">
                  <label className={LBL}>Est. Date To</label>
                  <input type="date" className={INP} value={forecastFilter.tarihBit} onChange={e => setForecastFilter(p => ({...p, tarihBit: e.target.value}))} />
                </div>
                <div className="flex items-center gap-2">
                  {(forecastFilter.containerNo || forecastFilter.musteri || forecastFilter.tarihBas || forecastFilter.tarihBit) && (
                    <button className={BTN_G} onClick={() => setForecastFilter({containerNo:"",musteri:"",tarihBas:"",tarihBit:""})}> ✕ Clear</button>
                  )}
                  <span className="text-xs text-slate-400">{filteredForecast.length} records</span>
                  <button className={BTN_P} onClick={() => setShowAddForecast(true)}>+ Add Forecast</button>
                </div>
              </div>

              {filteredForecast.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
                  <div className="text-4xl text-slate-200 mb-3">◈</div>
                  <div className="text-sm text-slate-400">{forecastList.length === 0 ? "No forecast records yet" : "No records match the filter criteria"}</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredForecast.map(fc => {
                    const gk = gunFarki(today(), fc.tahminiTarih);
                    const gecti = new Date(fc.tahminiTarih) < new Date();
                    const linked = containers.find(c => c.containerNo === fc.containerNo);
                    return (
                      <div key={fc.id} className="bg-white rounded-xl border border-slate-100 p-5"
                        style={{ borderLeft: `4px solid ${fc.onem === "high" ? "#ef4444" : fc.onem === "urgent" ? "#7c3aed" : "#3b82f6"}` }}>
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex-1 min-w-40">
                            <div className={`text-sm font-bold ${linked ? "text-blue-600 cursor-pointer underline" : "text-slate-700"}`}
                              onClick={() => { if (linked) { setSelectedContainer(linked); setActiveTab("detay"); } }}>
                              {fc.containerNo}
                              {linked && <span className="text-[10px] text-emerald-500 font-normal ml-1">↗ Detail</span>}
                            </div>
                            {fc.aciklama && <div className="text-xs text-slate-400 mt-0.5">{fc.aciklama}</div>}
                          </div>
                          <div className="text-sm font-medium text-slate-700 min-w-32">{fc.musteri}</div>
                          <div className="text-xs text-slate-400 min-w-24">
                            <div className="font-semibold text-slate-500 uppercase text-[10px] tracking-wide">Port</div>
                            {fc.liman || "—"}
                          </div>
                          <div className="text-xs text-slate-400 min-w-24">
                            <div className="font-semibold text-slate-500 uppercase text-[10px] tracking-wide">Est. Date</div>
                            {fc.tahminiTarih}
                          </div>
                          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${gecti ? "bg-red-50 text-red-600" : gk <= 3 ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}>
                            {gecti ? `${Math.abs(gk)} days overdue` : gk === 0 ? "Today" : `${gk} days left`}
                          </span>
                          <div className="flex gap-2 ml-auto">
                            <button className={BTN_S} onClick={() => handleForecastToContainer(fc)}>→ Open</button>
                            <button className={BTN_D} onClick={() => handleDeleteForecast(fc.id, fc.containerNo)}>Delete</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* LISTE (CONTAINERS) TAB                                */}
          {/* ══════════════════════════════════════════════════════ */}
          {activeTab === "liste" && (
            <div>
              <div className="bg-white rounded-xl border border-slate-100 p-4 mb-5 flex flex-wrap gap-3 items-center">
                <input className={`${INP} max-w-xs flex-1 min-w-40`} placeholder="Search container, customer, chassis..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <div className="flex gap-2">
                  {[["all","All"],["active","Active"],["closed","Closed"]].map(([v,l]) => (
                    <button key={v} onClick={() => setFilterDurum(v)}
                      className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${filterDurum===v ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{l}</button>
                  ))}
                </div>
                <div className="ml-auto flex gap-2">
                  <button className={BTN_P} onClick={() => setShowAddContainer(true)}>+ Add</button>
                  <button className="border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-emerald-50 transition-colors" onClick={exportContainersCSV}>⬇ Excel</button>
                  <button className="border border-red-200 text-red-500 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-red-50 transition-colors" onClick={() => exportPDF("containers")}>⊡ PDF</button>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                {filteredContainers.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-sm">No results found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>{["Container No","Chassis","Customer","Departure","Return","Days","Status",""].map(h=>(
                          <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {filteredContainers.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 cursor-pointer"
                            onClick={() => { setSelectedContainer(c); setActiveTab("detay"); }}>
                            <td className="px-5 py-3.5 text-sm font-semibold text-blue-600">{c.containerNo}</td>
                            <td className="px-5 py-3.5 text-sm text-slate-400">{c.chassisNo}</td>
                            <td className="px-5 py-3.5 text-sm text-slate-700 font-medium">{c.musteri}</td>
                            <td className="px-5 py-3.5 text-xs text-slate-400">{c.limanCikis}</td>
                            <td className="px-5 py-3.5 text-xs text-slate-400">{c.limanGiris || "—"}</td>
                            <td className="px-5 py-3.5 text-sm font-black" style={{ color: c.durum==="active" ? "#f59e0b" : "#94a3b8" }}>{gunFarki(c.limanCikis, c.limanGiris)}</td>
                            <td className="px-5 py-3.5">
                              {c.durum === "active"
                                ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Active</span>
                                : <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">Closed</span>
                              }
                            </td>
                            <td className="px-5 py-3.5">
                              <button className="text-xs text-blue-500 hover:text-blue-700 font-semibold"
                                onClick={e => { e.stopPropagation(); setSelectedContainer(c); setActiveTab("detay"); }}>Detail →</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* HAREKETLER (MOVEMENTS) TAB                            */}
          {/* ══════════════════════════════════════════════════════ */}
          {activeTab === "hareketler" && (
            <div>
              <div className="bg-white rounded-xl border border-slate-100 p-4 mb-5 flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-40">
                  <label className={LBL}>Container / Customer</label>
                  <input className={INP} placeholder="Filter..." value={hareketFilter.containerNo} onChange={e => setHareketFilter(p => ({...p, containerNo: e.target.value}))} />
                </div>
                <div className="flex-1 min-w-36">
                  <label className={LBL}>Driver</label>
                  <input className={INP} placeholder="Driver name..." value={hareketFilter.surucu} onChange={e => setHareketFilter(p => ({...p, surucu: e.target.value}))} />
                </div>
                <div className="flex-1 min-w-32">
                  <label className={LBL}>Start Date</label>
                  <input type="date" className={INP} value={hareketFilter.tarihBas} onChange={e => setHareketFilter(p => ({...p, tarihBas: e.target.value}))} />
                </div>
                <div className="flex-1 min-w-32">
                  <label className={LBL}>End Date</label>
                  <input type="date" className={INP} value={hareketFilter.tarihBit} onChange={e => setHareketFilter(p => ({...p, tarihBit: e.target.value}))} />
                </div>
                <div className="flex items-center gap-2">
                  {(hareketFilter.containerNo||hareketFilter.surucu||hareketFilter.tarihBas||hareketFilter.tarihBit) && (
                    <button className={BTN_G} onClick={() => setHareketFilter({containerNo:"",surucu:"",tarihBas:"",tarihBit:""})}> ✕ Clear</button>
                  )}
                  <span className="text-xs text-slate-400">{filteredHareketler.length} records</span>
                  <button className="border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-emerald-50 transition-colors" onClick={exportHareketlerCSV}>⬇ Excel</button>
                  <button className="border border-red-200 text-red-500 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-red-50 transition-colors" onClick={() => exportPDF("hareketler")}>⊡ PDF</button>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                {filteredHareketler.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-sm">No records match the filter criteria</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>{["Date","Container","Customer","Driver","Location / Route","KM","CO₂","Load","Surcharge"].map(h=>(
                          <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {filteredHareketler.map((h,i) => {
                          const ek = (h.surcharges||[]).reduce((s,sc)=>s+(Number(sc.tutar)||0),0);
                          const cont = containers.find(x=>x.containerNo===h.containerNo);
                          const co2 = calcCO2(h.km, h.kg||cont?.kg, h.euronorm);
                          const ef = EMISSION_FACTORS[h.euronorm||"euro6"]||EMISSION_FACTORS.euro6;
                          return (
                            <tr key={i} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 cursor-pointer"
                              onClick={()=>{const c=containers.find(x=>x.containerNo===h.containerNo);if(c){setSelectedContainer(c);setActiveTab("detay");}}}>
                              <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">{h.tarih}</td>
                              <td className="px-5 py-3.5 text-xs font-bold text-blue-600 whitespace-nowrap"
                                onClick={e=>{e.stopPropagation();const c=containers.find(x=>x.containerNo===h.containerNo);if(c){setSelectedContainer(c);setActiveTab("detay");}}}>{h.containerNo}</td>
                              <td className="px-5 py-3.5 text-xs text-slate-500">{h.musteri}</td>
                              <td className="px-5 py-3.5 text-xs text-slate-700">{h.surucu}</td>
                              <td className="px-5 py-3.5 text-xs text-slate-400 max-w-xs truncate">{h.konum}</td>
                              <td className="px-5 py-3.5 text-xs font-bold" style={{ color: h.km ? "#f59e0b" : "#94a3b8" }}>{h.km ? `${Number(h.km).toLocaleString()} km` : "—"}</td>
                              <td className="px-5 py-3.5">
                                {co2 ? <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: ef.bg, color: ef.color }}>{co2}kg</span> : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-5 py-3.5">
                                {h.yukDurumu === "loaded" && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">📦 Loaded</span>}
                                {h.yukDurumu === "empty" && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">⬜ Empty</span>}
                                {h.yukDurumu === "chassis-only" && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">🚛 Chassis</span>}
                              </td>
                              <td className="px-5 py-3.5 text-xs font-bold" style={{ color: ek > 0 ? "#ef4444" : "#94a3b8" }}>{ek > 0 ? `${ek.toLocaleString()} ₺` : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* AYARLAR (SETTINGS) TAB                                */}
          {/* ══════════════════════════════════════════════════════ */}
          {activeTab === "ayarlar" && (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Total Chassis", value: chassisWithDurum.length, color: "#2563eb" },
                  { label: "Available", value: chassisWithDurum.filter(c=>c.durum==="available").length, color: "#059669" },
                  { label: "In Use", value: chassisWithDurum.filter(c=>c.durum==="in-use").length, color: "#d97706" },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-5">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{s.label}</div>
                    <div className="text-4xl font-black mt-1" style={{ color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Chassis List</h2>
                  <button className={BTN_P} onClick={()=>setShowAddChassis(true)}>+ Add Chassis</button>
                </div>
                {chassisWithDurum.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-sm">No chassis added yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>{["Chassis No","Plate No","Type","Status",""].map(h=>(
                          <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {chassisWithDurum.map(ch => {
                          const ac = containers.find(c=>c.durum==="active"&&c.chassisNo===ch.chassisNo);
                          return (
                            <tr key={ch.id} className="border-b border-slate-50 last:border-0">
                              <td className="px-5 py-3.5 text-sm font-bold text-blue-600">{ch.chassisNo}</td>
                              <td className="px-5 py-3.5 text-sm text-slate-500">{ch.plakaNo}</td>
                              <td className="px-5 py-3.5">
                                <div className="flex gap-1 flex-wrap">
                                  {(Array.isArray(ch.tip)?ch.tip:ch.tip?[ch.tip]:[]).map(t=>(
                                    <span key={t} className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200">{t}</span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                {ch.durum === "available"
                                  ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Available</span>
                                  : <div>
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>In Use</span>
                                      {ac && <div className="text-xs text-slate-400 mt-1">{ac.containerNo}</div>}
                                    </div>
                                }
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex gap-2">
                                  <button className={BTN_G} style={{fontSize:"11px",padding:"5px 10px"}} onClick={()=>setEditChassis({...ch})}> ✏ Edit</button>
                                  <button className={BTN_D} style={{fontSize:"11px",padding:"5px 10px",opacity:ch.durum==="in-use"?0.4:1,cursor:ch.durum==="in-use"?"not-allowed":"pointer"}}
                                    onClick={()=>ch.durum!=="in-use"&&handleDeleteChassis(ch.id,ch.chassisNo)}
                                    title={ch.durum==="in-use"?"Cannot delete a chassis that is in use":"Delete"}>Delete</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* DETAY (DETAIL) TAB                                    */}
          {/* ══════════════════════════════════════════════════════ */}
          {activeTab === "detay" && (() => {
            if (!selectedContainer) return <div className="py-16 text-center text-slate-400 text-sm">No container selected.</div>;
            const c = selectedContainer;
            const totalKm = toplamKm(c.hareketler);
            const totalEk = surchargeToplamTumu(c.hareketler);
            const totalCO2 = co2Container(c);
            return (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <button className={BTN_G} onClick={()=>{setActiveTab("liste");setSelectedContainer(null);}}>← Back</button>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">{c.containerNo}</h2>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">{c.musteri}</p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    {c.durum === "active" && (
                      <>
                        <button className={BTN_P} onClick={()=>setShowAddHareket(true)}>+ Add Movement</button>
                        <button className={BTN_D} onClick={()=>setShowKapatModal(true)}>⬡ Return to Port</button>
                      </>
                    )}
                    {c.durum === "closed" && <span className="inline-flex items-center px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-500">✓ Operation Complete</span>}
                  </div>
                </div>

                {/* Info cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    ["Chassis No", c.chassisNo],
                    ["Container Type", c.containerType||"—"],
                    ["ADR", c.adr ? "⚠ Yes" : "No"],
                    ["Port Departure", c.limanCikis],
                    ["Port Return", c.limanGiris||"—"],
                    ["Total Days", `${gunFarki(c.limanCikis,c.limanGiris)} days`],
                    ["Total KM", `${totalKm.toLocaleString()} km`],
                    ["🌍 Total CO₂", totalCO2 > 0 ? `${totalCO2.toFixed(1)} kg` : "No data"],
                  ].map(([l,v])=>(
                    <div key={l} className="bg-white rounded-xl border border-slate-100 p-4">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{l}</div>
                      <div className={`text-sm font-bold ${l==="ADR"&&c.adr?"text-red-600":"text-slate-800"}`}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Surcharge summary */}
                {totalEk > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3.5 mb-5 flex items-center justify-between">
                    <span className="text-sm font-semibold text-red-600">Total Surcharges</span>
                    <span className="text-lg font-black text-red-600">{totalEk.toLocaleString()} ₺</span>
                  </div>
                )}

                {/* Movement history */}
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Movement History</h3>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {c.hareketler.map((h,i)=>{
                      const rowKm = Number(h.km)||0;
                      const kmAtPoint = c.hareketler.slice(0,i+1).reduce((s,x)=>s+(Number(x.km)||0),0);
                      const co2h = calcCO2(h.km, h.kg||c.kg, h.euronorm);
                      const ef = EMISSION_FACTORS[h.euronorm||"euro6"]||EMISSION_FACTORS.euro6;
                      return (
                        <div key={i} className="px-5 py-4" style={{borderLeft: i===c.hareketler.length-1?"3px solid #059669":"3px solid #e2e8f0"}}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-slate-400">{h.tarih}</span>
                                {h.surucu && h.surucu !== "-" && <span className="text-xs text-slate-500">· {h.surucu}</span>}
                                {h.firma && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">{h.firma}</span>}
                                {h.referans && <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">REF: {h.referans}</span>}
                              </div>
                              <div className="text-sm text-slate-700 font-medium">{h.konum}</div>
                              {h.aciklama && <div className="text-xs text-slate-400 mt-0.5">{h.aciklama}</div>}
                              {h.yukDurumu === "loaded" && <span className="mt-1 inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">📦 Loaded{h.kg ? ` · ${Number(h.kg).toLocaleString()} kg` : ""}</span>}
                              {h.yukDurumu === "empty" && <span className="mt-1 inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">⬜ Empty{h.kg ? ` · ${Number(h.kg).toLocaleString()} kg` : ""}</span>}
                              {h.yukDurumu === "chassis-only" && <span className="mt-1 inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">🚛 Chassis{h.kg ? ` · ${Number(h.kg).toLocaleString()} kg` : ""}</span>}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              {rowKm > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400">route</span>
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">{rowKm.toLocaleString()} km</span>
                                  <span className="text-xs text-slate-400">total</span>
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">{kmAtPoint.toLocaleString()} km</span>
                                </div>
                              )}
                              {co2h && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:ef.bg,color:ef.color}}>{co2h} kg CO₂</span>}
                              <button className="text-[10px] text-blue-500 hover:text-blue-700 font-semibold"
                                onClick={()=>{setEditHareketIdx(i);setEditHareket({...h,euronorm:h.euronorm||"euro6"});setEditSurchargeLines(h.surcharges||[]);}}>✏ Edit</button>
                            </div>
                          </div>
                          {(h.surcharges||[]).length>0&&(
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Surcharges</span>
                                <span className="text-sm font-black text-red-500">Total: {surchargeToplamHareket(h).toLocaleString()} ₺</span>
                              </div>
                              <div className="space-y-1.5">
                                {h.surcharges.map((sc,si)=>{
                                  const tip=SURCHARGE_TIPLERI[sc.tip]||SURCHARGE_TIPLERI.diger;
                                  return(
                                    <div key={si} className="flex items-center justify-between rounded-lg px-3 py-2" style={{background:tip.bg,border:`1px solid ${tip.border}`}}>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold" style={{color:tip.color}}>{tip.label}</span>
                                        {sc.aciklama&&<span className="text-xs text-slate-500">{sc.aciklama}</span>}
                                        {sc.tip==="waiting"&&sc.saat&&<span className="text-xs text-slate-400">{sc.saat}h × {Number(sc.saatUcreti).toLocaleString()} ₺</span>}
                                      </div>
                                      <span className="text-sm font-black" style={{color:tip.color}}>{Number(sc.tutar).toLocaleString()} ₺</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

        </main>
      </div>{/* end main */}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* MODALS                                                      */}
      {/* ════════════════════════════════════════════════════════════ */}

      {/* MODAL: New Container */}
      {showAddContainer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-base font-bold text-slate-800">New Container</h2>
              <button className="text-slate-400 hover:text-slate-600 text-2xl leading-none" onClick={()=>{setShowAddContainer(false);setContainerFormError("");}}>×</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {[["Container No","containerNo","MSCU1234567"],["Customer / Company","musteri","Company Name"]].map(([l,k,ph])=>(
                <div key={k}>
                  <label className={LBL}>{l}</label>
                  <input className={INP} placeholder={ph} value={newContainer[k]} onChange={e=>setNewContainer(p=>({...p,[k]:e.target.value}))} />
                </div>
              ))}
              <div>
                <label className={LBL}>Container Type</label>
                <div className="flex gap-2">
                  {["20FT","40FT","45FT"].map(t=>(
                    <button key={t} type="button" onClick={()=>setNewContainer(p=>({...p,containerType:t}))}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-lg border-2 transition-all ${newContainer.containerType===t?"border-blue-500 bg-blue-50 text-blue-700":"border-slate-200 text-slate-400 hover:border-slate-300"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={LBL}>Select Chassis <span className="text-red-500">*</span></label>
                <select className={`${INP} cursor-pointer`} value={newContainer.chassisNo}
                  onChange={e=>{setNewContainer(p=>({...p,chassisNo:e.target.value}));setContainerFormError("");}}
                  style={{borderColor:containerFormError?"#ef4444":undefined}}>
                  <option value="">— Select chassis —</option>
                  {musaitChassis.map(ch=>(
                    <option key={ch.id} value={ch.chassisNo}>{ch.chassisNo} · {ch.plakaNo} · {Array.isArray(ch.tip)?ch.tip.join(", "):(ch.tip||"")}</option>
                  ))}
                </select>
                {containerFormError&&<p className="text-red-500 text-xs mt-1.5">⚠ {containerFormError}</p>}
                {musaitChassis.length===0&&<p className="text-red-500 text-xs mt-1.5">⚠ No available chassis. Add chassis in Settings.</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LBL}>Cargo Weight (KG)</label>
                  <input type="number" className={INP} placeholder="e.g. 24000" min="0" value={newContainer.kg} onChange={e=>setNewContainer(p=>({...p,kg:e.target.value}))} />
                </div>
                <div>
                  <label className={LBL}>ADR (Hazardous)</label>
                  <div className="flex gap-2">
                    {[["No",false],["Yes",true]].map(([l,v])=>(
                      <button key={l} type="button" onClick={()=>setNewContainer(p=>({...p,adr:v}))}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg border-2 transition-all ${newContainer.adr===v?(v?"border-red-500 bg-red-50 text-red-700":"border-emerald-500 bg-emerald-50 text-emerald-700"):"border-slate-200 text-slate-400 hover:border-slate-300"}`}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className={LBL}>Port Departure Date</label>
                <input type="date" className={INP} value={newContainer.limanCikis} onChange={e=>setNewContainer(p=>({...p,limanCikis:e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <button className={`${BTN_S} flex-1`} onClick={handleAddContainer}>Open Container</button>
              <button className={BTN_G} onClick={()=>{setShowAddContainer(false);setContainerFormError("");}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Movement */}
      {showAddHareket && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-base font-bold text-blue-600">🚛 Add Movement</h2>
              <button className="text-slate-400 hover:text-slate-600 text-2xl leading-none" onClick={()=>{setShowAddHareket(false);setSurchargeLines([]);setAddErrors({});setNewSurcharge({tip:"custom_stop",aciklama:"",tutar:"",saat:"",saatUcreti:""});}}>×</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[["Driver","surucu","Driver name"],["Company","firma","Company name"]].map(([l,k,ph])=>(
                  <div key={k}>
                    <label className={`${LBL} ${addErrors[k]?"text-red-500":""}`}>{l} {addErrors[k]&&<span className="text-red-400 text-[10px] normal-case font-normal">⚠ {addErrors[k]}</span>}</label>
                    <input className={`${INP} ${addErrors[k]?"border-red-400":""}`} placeholder={ph} value={newHareket[k]}
                      onChange={e=>{setNewHareket(p=>({...p,[k]:e.target.value}));setAddErrors(p=>({...p,[k]:""}));}} />
                  </div>
                ))}
              </div>

              {/* Load Status */}
              <div>
                <label className={LBL}>Container Load Status</label>
                <div className="flex gap-2 mb-3">
                  {[
                    {val:"loaded",label:"📦 Loaded",active:"border-blue-500 bg-blue-50 text-blue-700"},
                    {val:"empty",label:"⬜ Empty",active:"border-slate-400 bg-slate-50 text-slate-600"},
                    {val:"chassis-only",label:"🚛 Chassis Only",active:"border-amber-500 bg-amber-50 text-amber-700"},
                  ].map(opt=>(
                    <button key={opt.val} type="button" onClick={()=>setNewHareket(p=>({...p,yukDurumu:opt.val}))}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-lg border-2 transition-all ${newHareket.yukDurumu===opt.val?opt.active:"border-slate-200 text-slate-400 hover:border-slate-300"}`}>{opt.label}</button>
                  ))}
                </div>
                {newHareket.yukDurumu==="chassis-only"&&(
                  <input className={INP} placeholder="Note: Which container, where to go..." value={newHareket.yukNotu} onChange={e=>setNewHareket(p=>({...p,yukNotu:e.target.value}))} />
                )}
                <div className="mt-3">
                  <label className={`${LBL} ${addErrors.kg?"text-red-500":""}`}>
                    {newHareket.yukDurumu==="loaded"?"📦 Cargo Weight (KG)":newHareket.yukDurumu==="empty"?"⬜ Tare Weight (KG)":"🚛 Chassis Weight (KG)"} <span className="text-red-500">*</span>
                    {addErrors.kg&&<span className="text-red-400 text-[10px] normal-case font-normal ml-1">⚠ {addErrors.kg}</span>}
                  </label>
                  <input type="number" className={`${INP} ${addErrors.kg?"border-red-400":""}`} min="0" style={{textAlign:"right"}}
                    placeholder={newHareket.yukDurumu==="loaded"?"e.g. 24000":newHareket.yukDurumu==="empty"?"e.g. 2200":"e.g. 6500"}
                    value={newHareket.kg} onChange={e=>{setNewHareket(p=>({...p,kg:e.target.value}));setAddErrors(p=>({...p,kg:""}))}} />
                  <p className="text-xs text-slate-400 mt-1">{newHareket.yukDurumu==="loaded"?"Total including cargo + container":newHareket.yukDurumu==="empty"?"20FT≈2,200kg · 40FT≈3,800kg · 45FT≈4,500kg":"Standard chassis ≈ 6,000–8,000 kg"}</p>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className={`${LBL} ${addErrors.konum?"text-red-500":""}`}>Location / Route{addErrors.konum&&<span className="text-red-400 text-[10px] normal-case font-normal ml-1">⚠ {addErrors.konum}</span>}</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">📍 Departure</div>
                    <SuggestInput value={newHareket.konumFrom} field="addFrom" placeholder="City, street or postcode"
                      hasError={!!addErrors.konum} suggestions={suggestions} sugLoading={sugLoading} activeSug={activeSug} setActiveSug={setActiveSug} setSuggestions={setSuggestions} fetchSuggestions={fetchSuggestions}
                      onChange={v=>{setNewHareket(p=>({...p,konumFrom:v,konum:v&&p.konumTo?v+" → "+p.konumTo:v||p.konumTo||""}));setAddErrors(p=>({...p,konum:""}));}}
                      onSelect={(_,fmt)=>{setNewHareket(p=>({...p,konumFrom:fmt,konum:fmt&&p.konumTo?fmt+" → "+p.konumTo:fmt||p.konumTo||""}));}} />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">🏁 Destination</div>
                    <SuggestInput value={newHareket.konumTo} field="addTo" placeholder="City, street or postcode"
                      hasError={!!addErrors.konum} suggestions={suggestions} sugLoading={sugLoading} activeSug={activeSug} setActiveSug={setActiveSug} setSuggestions={setSuggestions} fetchSuggestions={fetchSuggestions}
                      onChange={v=>{setNewHareket(p=>({...p,konumTo:v,konum:p.konumFrom&&v?p.konumFrom+" → "+v:p.konumFrom||v||""}));setAddErrors(p=>({...p,konum:""}));}}
                      onSelect={(_,fmt)=>{setNewHareket(p=>({...p,konumTo:fmt,konum:p.konumFrom&&fmt?p.konumFrom+" → "+fmt:p.konumFrom||fmt||""}));}} />
                  </div>
                </div>
                <button type="button" className={`${BTN_P} w-full`}
                  onClick={()=>calculateKm(newHareket.konumFrom,newHareket.konumTo,(km)=>setNewHareket(p=>({...p,km})))}
                  disabled={kmLoading||!newHareket.konumFrom||!newHareket.konumTo}>
                  {kmLoading?"⏳ Calculating...":"📍 Calculate KM Automatically"}
                </button>
                {kmError&&<p className="text-red-500 text-xs mt-1.5">⚠ {kmError}</p>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[["Reference","referans","Ref. no"],["Note","aciklama","Note"]].map(([l,k,ph])=>(
                  <div key={k}>
                    <label className={LBL}>{l}</label>
                    <input className={INP} placeholder={ph} value={newHareket[k]} onChange={e=>setNewHareket(p=>({...p,[k]:e.target.value}))} />
                  </div>
                ))}
                <div>
                  <label className={LBL}>KM{kmLoading&&<span className="text-blue-400 text-[10px] ml-1 normal-case font-normal"> calculating...</span>}</label>
                  <input type="number" className={INP} placeholder="auto-calculate ↑" min="0" value={newHareket.km}
                    onChange={e=>setNewHareket(p=>({...p,km:e.target.value}))} style={{textAlign:"right"}} />
                </div>
              </div>

              {/* Euro Norm */}
              <div>
                <label className={LBL}>🌍 Vehicle Standard (Euro Norm)</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Object.entries(EMISSION_FACTORS).map(([k,ef])=>(
                    <button key={k} type="button" onClick={()=>setNewHareket(p=>({...p,euronorm:k}))}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all`}
                      style={{borderColor:newHareket.euronorm===k?ef.color:"#e2e8f0",background:newHareket.euronorm===k?ef.bg:"#fff",color:newHareket.euronorm===k?ef.color:"#94a3b8"}}>{ef.label}</button>
                  ))}
                </div>
                {(()=>{
                  const co2=calcCO2(newHareket.km,newHareket.kg||selectedContainer?.kg,newHareket.euronorm);
                  const ef=EMISSION_FACTORS[newHareket.euronorm]||EMISSION_FACTORS.euro6;
                  return co2?(
                    <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{background:ef.bg,border:`1px solid ${ef.border}`}}>
                      <span className="text-lg">🌿</span>
                      <span className="text-base font-black" style={{color:ef.color}}>{co2} kg CO₂</span>
                      <span className="text-xs text-slate-400">estimated for this route</span>
                    </div>
                  ):<p className="text-xs text-slate-300">Enter KM + weight to see CO₂ estimate</p>;
                })()}
              </div>

              <div>
                <label className={LBL}>Date</label>
                <input type="date" className={INP} value={newHareket.tarih} onChange={e=>setNewHareket(p=>({...p,tarih:e.target.value}))} />
              </div>

              {/* Surcharges */}
              <div className="border-t border-slate-100 pt-4">
                <label className={LBL}>💰 Surcharges</label>
                {surchargeLines.length>0&&(
                  <div className="space-y-2 mb-3">
                    {surchargeLines.map((sc,i)=>{
                      const tip=SURCHARGE_TIPLERI[sc.tip]||SURCHARGE_TIPLERI.diger;
                      return(
                        <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{background:tip.bg,border:`1px solid ${tip.border}`}}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold" style={{color:tip.color}}>{tip.label}</span>
                            {sc.aciklama&&<span className="text-xs text-slate-500">{sc.aciklama}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black" style={{color:tip.color}}>{Number(sc.tutar).toLocaleString()} ₺</span>
                            <button onClick={()=>setSurchargeLines(p=>p.filter((_,idx)=>idx!==i))} className="text-slate-400 hover:text-red-500 text-lg leading-none">×</button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-right text-sm font-black text-red-500">Total: {surchargeLines.reduce((s,sc)=>s+(Number(sc.tutar)||0),0).toLocaleString()} ₺</div>
                  </div>
                )}
                <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Add Surcharge Item</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={LBL}>Type</label>
                      <select className={`${INP} cursor-pointer`} value={newSurcharge.tip} onChange={e=>setNewSurcharge(p=>({...p,tip:e.target.value,saat:"",saatUcreti:"",tutar:""}))}>
                        {Object.entries(SURCHARGE_TIPLERI).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LBL}>Description</label>
                      <input className={INP} placeholder="optional" value={newSurcharge.aciklama} onChange={e=>setNewSurcharge(p=>({...p,aciklama:e.target.value}))} />
                    </div>
                  </div>
                  {newSurcharge.tip==="waiting"?(
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className={LBL}>Hours</label><input type="number" className={INP} placeholder="2" min="0" value={newSurcharge.saat} onChange={e=>{const s=e.target.value;setNewSurcharge(p=>({...p,saat:s,tutar:(Number(s)*Number(p.saatUcreti))||""}))}} style={{textAlign:"right"}} /></div>
                      <div><label className={LBL}>Rate (₺)</label><input type="number" className={INP} placeholder="500" min="0" value={newSurcharge.saatUcreti} onChange={e=>{const su=e.target.value;setNewSurcharge(p=>({...p,saatUcreti:su,tutar:(Number(p.saat)*Number(su))||""}))}} style={{textAlign:"right"}} /></div>
                      <div><label className="block text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1.5">Calculated ₺</label><input type="number" className={INP} value={newSurcharge.tutar} readOnly style={{textAlign:"right",background:"#fef3c7",borderColor:"#fcd34d",fontWeight:700,color:"#d97706"}} /></div>
                    </div>
                  ):(
                    <div><label className={LBL}>Amount (₺)</label><input type="number" className={INP} placeholder="e.g. 1500" min="0" value={newSurcharge.tutar} onChange={e=>setNewSurcharge(p=>({...p,tutar:e.target.value}))} style={{textAlign:"right"}} /></div>
                  )}
                  <button className={`${BTN_P} w-full`} onClick={()=>{if(!newSurcharge.tutar||Number(newSurcharge.tutar)<=0)return;setSurchargeLines(p=>[...p,{...newSurcharge}]);setNewSurcharge({tip:"custom_stop",aciklama:"",tutar:"",saat:"",saatUcreti:""});}}>+ Add Item to List</button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <button className={`${BTN_P} flex-1`} onClick={handleAddHareket}>💾 Save Movement</button>
              <button className={BTN_G} onClick={()=>{setShowAddHareket(false);setSurchargeLines([]);setAddErrors({});setNewSurcharge({tip:"custom_stop",aciklama:"",tutar:"",saat:"",saatUcreti:""});}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Close / Return to Port */}
      {showKapatModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-2xl p-6">
            <h2 className="text-base font-bold text-red-600 mb-2">Return to Port</h2>
            <p className="text-sm text-slate-500 mb-5">Are you sure you want to close this operation? Billing will be initiated.</p>
            <div className="mb-5">
              <label className={LBL}>Port Return Date</label>
              <input type="date" className={INP} id="kapatTarih" defaultValue={today()} />
            </div>
            <div className="flex gap-3">
              <button className={`${BTN_D} flex-1`} onClick={()=>handleKapat(document.getElementById("kapatTarih").value)}>Close and Bill</button>
              <button className={BTN_G} onClick={()=>setShowKapatModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Forecast */}
      {showAddForecast && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-base font-bold text-purple-600">Add Forecast</h2>
              <button className="text-slate-400 hover:text-slate-600 text-2xl leading-none" onClick={()=>setShowAddForecast(false)}>×</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {[["Container No","containerNo","MSCU1234567"],["Customer / Company","musteri","Company Name"],["Port","liman","Port name..."],["Notes","aciklama","Optional note"]].map(([l,k,ph])=>(
                <div key={k}>
                  <label className={LBL}>{l}</label>
                  <input className={INP} placeholder={ph} value={newForecast[k]} onChange={e=>setNewForecast(p=>({...p,[k]:e.target.value}))} />
                </div>
              ))}
              <div>
                <label className={LBL}>Container Type</label>
                <div className="flex gap-2">
                  {["20FT","40FT","45FT"].map(t=>(
                    <button key={t} type="button" onClick={()=>setNewForecast(p=>({...p,containerType:t}))}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-lg border-2 transition-all ${newForecast.containerType===t?"border-purple-500 bg-purple-50 text-purple-700":"border-slate-200 text-slate-400 hover:border-slate-300"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LBL}>Cargo Weight (KG)</label>
                  <input type="number" className={INP} placeholder="e.g. 24000" min="0" value={newForecast.kg} onChange={e=>setNewForecast(p=>({...p,kg:e.target.value}))} style={{textAlign:"right"}} />
                </div>
                <div>
                  <label className={LBL}>ADR</label>
                  <div className="flex gap-2">
                    {[["No",false],["Yes",true]].map(([l,v])=>(
                      <button key={l} type="button" onClick={()=>setNewForecast(p=>({...p,adr:v}))}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg border-2 transition-all ${newForecast.adr===v?(v?"border-red-500 bg-red-50 text-red-700":"border-emerald-500 bg-emerald-50 text-emerald-700"):"border-slate-200 text-slate-400"}`}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LBL}>Est. Date</label>
                  <input type="date" className={INP} value={newForecast.tahminiTarih} onChange={e=>setNewForecast(p=>({...p,tahminiTarih:e.target.value}))} />
                </div>
                <div>
                  <label className={LBL}>Priority</label>
                  <select className={`${INP} cursor-pointer`} value={newForecast.onem} onChange={e=>setNewForecast(p=>({...p,onem:e.target.value}))}>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <button className="flex-1 bg-purple-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-purple-700 transition-colors" onClick={handleAddForecast}>Save Forecast</button>
              <button className={BTN_G} onClick={()=>setShowAddForecast(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Movement */}
      {editHareket && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-base font-bold text-amber-600">✏ Edit Movement</h2>
              <button className="text-slate-400 hover:text-slate-600 text-2xl leading-none" onClick={()=>{setEditHareketIdx(null);setEditHareket(null);setEditSurchargeLines([]);setEditErrors({});}}>×</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[["Driver","surucu","Driver name"],["Company","firma","Company name"]].map(([l,k,ph])=>(
                  <div key={k}>
                    <label className={`${LBL} ${editErrors[k]?"text-red-500":""}`}>{l} {editErrors[k]&&<span className="text-red-400 text-[10px] normal-case font-normal">⚠ {editErrors[k]}</span>}</label>
                    <input className={`${INP} ${editErrors[k]?"border-red-400":""}`} placeholder={ph} value={editHareket[k]||""}
                      onChange={e=>{setEditHareket(p=>({...p,[k]:e.target.value}));setEditErrors(p=>({...p,[k]:""}));}} />
                  </div>
                ))}
              </div>
              <div>
                <label className={LBL}>Container Load Status</label>
                <div className="flex gap-2 mb-3">
                  {[
                    {val:"loaded",label:"📦 Loaded",active:"border-blue-500 bg-blue-50 text-blue-700"},
                    {val:"empty",label:"⬜ Empty",active:"border-slate-400 bg-slate-50 text-slate-600"},
                    {val:"chassis-only",label:"🚛 Chassis Only",active:"border-amber-500 bg-amber-50 text-amber-700"},
                  ].map(opt=>(
                    <button key={opt.val} type="button" onClick={()=>setEditHareket(p=>({...p,yukDurumu:opt.val}))}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-lg border-2 transition-all ${(editHareket.yukDurumu||"loaded")===opt.val?opt.active:"border-slate-200 text-slate-400 hover:border-slate-300"}`}>{opt.label}</button>
                  ))}
                </div>
                {(editHareket.yukDurumu||"loaded")==="chassis-only"&&(
                  <input className={INP} placeholder="Note: Which container, where to go..." value={editHareket.yukNotu||""} onChange={e=>setEditHareket(p=>({...p,yukNotu:e.target.value}))} />
                )}
                <div className="mt-3">
                  <label className={`${LBL} ${editErrors.kg?"text-red-500":""}`}>
                    {(editHareket.yukDurumu||"loaded")==="loaded"?"📦 Cargo Weight (KG)":(editHareket.yukDurumu||"loaded")==="empty"?"⬜ Tare Weight (KG)":"🚛 Chassis Weight (KG)"} <span className="text-red-500">*</span>
                    {editErrors.kg&&<span className="text-red-400 text-[10px] normal-case font-normal ml-1">⚠ {editErrors.kg}</span>}
                  </label>
                  <input type="number" className={`${INP} ${editErrors.kg?"border-red-400":""}`} min="0" style={{textAlign:"right"}}
                    placeholder={(editHareket.yukDurumu||"loaded")==="loaded"?"e.g. 24000":(editHareket.yukDurumu||"loaded")==="empty"?"e.g. 2200":"e.g. 6500"}
                    value={editHareket.kg||""} onChange={e=>{setEditHareket(p=>({...p,kg:e.target.value}));setEditErrors(p=>({...p,kg:""}));}} />
                  <p className="text-xs text-slate-400 mt-1">{(editHareket.yukDurumu||"loaded")==="loaded"?"Total including cargo + container":(editHareket.yukDurumu||"loaded")==="empty"?"20FT≈2,200kg · 40FT≈3,800kg · 45FT≈4,500kg":"Standard chassis ≈ 6,000–8,000 kg"}</p>
                </div>
              </div>
              <div>
                <label className={`${LBL} ${editErrors.konum?"text-red-500":""}`}>Location / Route{editErrors.konum&&<span className="text-red-400 text-[10px] normal-case font-normal ml-1">⚠ {editErrors.konum}</span>}</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">📍 Departure</div>
                    <SuggestInput value={editHareket.konumFrom||(editHareket.konum||"").split("→")[0]?.trim()||""} field="editFrom" placeholder="City, street or postcode"
                      hasError={!!editErrors.konum} suggestions={suggestions} sugLoading={sugLoading} activeSug={activeSug} setActiveSug={setActiveSug} setSuggestions={setSuggestions} fetchSuggestions={fetchSuggestions}
                      onChange={v=>{const to=editHareket.konumTo||(editHareket.konum||"").split("→")[1]?.trim()||"";setEditHareket(p=>({...p,konumFrom:v,konum:v&&to?v+" → "+to:v||to||""}));setEditErrors(p=>({...p,konum:""}));}}
                      onSelect={(_,fmt)=>{const to=editHareket.konumTo||(editHareket.konum||"").split("→")[1]?.trim()||"";setEditHareket(p=>({...p,konumFrom:fmt,konum:fmt&&to?fmt+" → "+to:fmt||to||""}));}} />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">🏁 Destination</div>
                    <SuggestInput value={editHareket.konumTo||(editHareket.konum||"").split("→")[1]?.trim()||""} field="editTo" placeholder="City, street or postcode"
                      hasError={!!editErrors.konum} suggestions={suggestions} sugLoading={sugLoading} activeSug={activeSug} setActiveSug={setActiveSug} setSuggestions={setSuggestions} fetchSuggestions={fetchSuggestions}
                      onChange={v=>{const from=editHareket.konumFrom||(editHareket.konum||"").split("→")[0]?.trim()||"";setEditHareket(p=>({...p,konumTo:v,konum:from&&v?from+" → "+v:from||v||""}));setEditErrors(p=>({...p,konum:""}));}}
                      onSelect={(_,fmt)=>{const from=editHareket.konumFrom||(editHareket.konum||"").split("→")[0]?.trim()||"";setEditHareket(p=>({...p,konumTo:fmt,konum:from&&fmt?from+" → "+fmt:from||fmt||""}));}} />
                  </div>
                </div>
                <button type="button" className={`${BTN_P} w-full`}
                  onClick={()=>{const from=editHareket.konumFrom||(editHareket.konum||"").split("→")[0]?.trim()||"";const to=editHareket.konumTo||(editHareket.konum||"").split("→")[1]?.trim()||"";calculateKm(from,to,(km)=>setEditHareket(p=>({...p,km})));}}
                  disabled={kmLoading||(!(editHareket.konumFrom||(editHareket.konum||"").split("→")[0]?.trim())||!(editHareket.konumTo||(editHareket.konum||"").split("→")[1]?.trim()))}>
                  {kmLoading?"⏳ Calculating...":"📍 Calculate KM Automatically"}
                </button>
                {kmError&&<p className="text-red-500 text-xs mt-1.5">⚠ {kmError}</p>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[["Reference","referans","Ref. no"],["Note","aciklama","Note"]].map(([l,k,ph])=>(
                  <div key={k}>
                    <label className={LBL}>{l}</label>
                    <input className={INP} placeholder={ph} value={editHareket[k]||""} onChange={e=>setEditHareket(p=>({...p,[k]:e.target.value}))} />
                  </div>
                ))}
                <div>
                  <label className={LBL}>KM{kmLoading&&<span className="text-blue-400 text-[10px] ml-1 normal-case font-normal"> calculating...</span>}</label>
                  <input type="number" className={INP} placeholder="auto-calculate ↑" min="0" value={editHareket.km||""} onChange={e=>setEditHareket(p=>({...p,km:e.target.value}))} style={{textAlign:"right"}} />
                </div>
              </div>
              <div>
                <label className={LBL}>🌍 Vehicle Standard (Euro Norm)</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Object.entries(EMISSION_FACTORS).map(([k,ef])=>(
                    <button key={k} type="button" onClick={()=>setEditHareket(p=>({...p,euronorm:k}))}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all"
                      style={{borderColor:(editHareket.euronorm||"euro6")===k?ef.color:"#e2e8f0",background:(editHareket.euronorm||"euro6")===k?ef.bg:"#fff",color:(editHareket.euronorm||"euro6")===k?ef.color:"#94a3b8"}}>{ef.label}</button>
                  ))}
                </div>
                {(()=>{
                  const co2=calcCO2(editHareket.km,editHareket.kg||selectedContainer?.kg,editHareket.euronorm||"euro6");
                  const ef=EMISSION_FACTORS[editHareket.euronorm||"euro6"]||EMISSION_FACTORS.euro6;
                  return co2?(
                    <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{background:ef.bg,border:`1px solid ${ef.border}`}}>
                      <span className="text-lg">🌿</span>
                      <span className="text-base font-black" style={{color:ef.color}}>{co2} kg CO₂</span>
                      <span className="text-xs text-slate-400">estimated for this route</span>
                    </div>
                  ):<p className="text-xs text-slate-300">Enter KM + weight to see CO₂ estimate</p>;
                })()}
              </div>
              <div>
                <label className={LBL}>Date</label>
                <input type="date" className={INP} value={editHareket.tarih||""} onChange={e=>setEditHareket(p=>({...p,tarih:e.target.value}))} />
              </div>
              <div className="border-t border-slate-100 pt-4">
                <label className={LBL}>💰 Surcharges</label>
                {editSurchargeLines.length>0&&(
                  <div className="space-y-2 mb-3">
                    {editSurchargeLines.map((sc,i)=>{
                      const tip=SURCHARGE_TIPLERI[sc.tip]||SURCHARGE_TIPLERI.diger;
                      return(
                        <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{background:tip.bg,border:`1px solid ${tip.border}`}}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold" style={{color:tip.color}}>{tip.label}</span>
                            {sc.aciklama&&<span className="text-xs text-slate-500">{sc.aciklama}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black" style={{color:tip.color}}>{Number(sc.tutar).toLocaleString()} ₺</span>
                            <button onClick={()=>setEditSurchargeLines(p=>p.filter((_,idx)=>idx!==i))} className="text-slate-400 hover:text-red-500 text-lg leading-none">×</button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-right text-sm font-black text-red-500">Total: {editSurchargeLines.reduce((s,sc)=>s+(Number(sc.tutar)||0),0).toLocaleString()} ₺</div>
                  </div>
                )}
                <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Add Surcharge Item</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={LBL}>Type</label>
                      <select className={`${INP} cursor-pointer`} value={editNewSurcharge.tip} onChange={e=>setEditNewSurcharge(p=>({...p,tip:e.target.value,saat:"",saatUcreti:"",tutar:""}))}>
                        {Object.entries(SURCHARGE_TIPLERI).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LBL}>Description</label>
                      <input className={INP} placeholder="optional" value={editNewSurcharge.aciklama} onChange={e=>setEditNewSurcharge(p=>({...p,aciklama:e.target.value}))} />
                    </div>
                  </div>
                  {editNewSurcharge.tip==="waiting"?(
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className={LBL}>Hours</label><input type="number" className={INP} placeholder="2" min="0" value={editNewSurcharge.saat} onChange={e=>{const s=e.target.value;setEditNewSurcharge(p=>({...p,saat:s,tutar:(Number(s)*Number(p.saatUcreti))||""}))}} style={{textAlign:"right"}} /></div>
                      <div><label className={LBL}>Rate (₺)</label><input type="number" className={INP} placeholder="500" min="0" value={editNewSurcharge.saatUcreti} onChange={e=>{const su=e.target.value;setEditNewSurcharge(p=>({...p,saatUcreti:su,tutar:(Number(p.saat)*Number(su))||""}))}} style={{textAlign:"right"}} /></div>
                      <div><label className="block text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1.5">Calculated ₺</label><input type="number" className={INP} value={editNewSurcharge.tutar} readOnly style={{textAlign:"right",background:"#fef3c7",borderColor:"#fcd34d",fontWeight:700,color:"#d97706"}} /></div>
                    </div>
                  ):(
                    <div><label className={LBL}>Amount (₺)</label><input type="number" className={INP} placeholder="e.g. 1500" min="0" value={editNewSurcharge.tutar} onChange={e=>setEditNewSurcharge(p=>({...p,tutar:e.target.value}))} style={{textAlign:"right"}} /></div>
                  )}
                  <button className={`${BTN_P} w-full`} onClick={()=>{if(!editNewSurcharge.tutar||Number(editNewSurcharge.tutar)<=0)return;setEditSurchargeLines(p=>[...p,{...editNewSurcharge}]);setEditNewSurcharge({tip:"custom_stop",aciklama:"",tutar:"",saat:"",saatUcreti:""});}}>+ Add Item to List</button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <button className={`${BTN_P} flex-1`} onClick={handleSaveEditHareket}>💾 Save Changes</button>
              <button className={BTN_G} onClick={()=>{setEditHareketIdx(null);setEditHareket(null);setEditSurchargeLines([]);setEditErrors({});}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Chassis */}
      {editChassis && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-2xl p-6">
            <h2 className="text-base font-bold text-amber-600 mb-5">✏ Edit Chassis</h2>
            {[["Chassis No","chassisNo","CHS-001"],["Plate No","plakaNo","34 ABC 001"]].map(([l,k,ph])=>(
              <div key={k} className="mb-4">
                <label className={LBL}>{l}</label>
                <input className={INP} placeholder={ph} value={editChassis[k]} onChange={e=>setEditChassis(p=>({...p,[k]:e.target.value}))} />
              </div>
            ))}
            <div className="mb-5">
              <label className={LBL}>Chassis Type <span className="text-slate-400 text-[10px] normal-case font-normal">(multi-select)</span></label>
              <div className="flex gap-2">
                {["20FT","40FT","45FT"].map(t=>{
                  const arr=Array.isArray(editChassis.tip)?editChassis.tip:(editChassis.tip?[editChassis.tip]:[]);
                  const sel=arr.includes(t);
                  return(
                    <button key={t} type="button"
                      onClick={()=>setEditChassis(p=>{const cur=Array.isArray(p.tip)?p.tip:(p.tip?[p.tip]:[]);return{...p,tip:sel?cur.filter(x=>x!==t):[...cur,t]};})}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-lg border-2 transition-all ${sel?"border-blue-500 bg-blue-50 text-blue-700":"border-slate-200 text-slate-400 hover:border-slate-300"}`}>{t}</button>
                  );
                })}
              </div>
              {(Array.isArray(editChassis.tip)?editChassis.tip:[]).length===0&&<p className="text-red-500 text-xs mt-1.5">Select at least one type</p>}
            </div>
            <div className="flex gap-3">
              <button className={`${BTN_P} flex-1`} onClick={handleSaveEditChassis}>Save</button>
              <button className={BTN_G} onClick={()=>setEditChassis(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Chassis */}
      {showAddChassis && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-2xl p-6">
            <h2 className="text-base font-bold text-blue-600 mb-5">Define New Chassis</h2>
            {[["Chassis No","chassisNo","CHS-001"],["Plate No","plakaNo","34 ABC 001"]].map(([l,k,ph])=>(
              <div key={k} className="mb-4">
                <label className={LBL}>{l}</label>
                <input className={INP} placeholder={ph} value={newChassis[k]} onChange={e=>setNewChassis(p=>({...p,[k]:e.target.value}))} />
              </div>
            ))}
            <div className="mb-5">
              <label className={LBL}>Chassis Type <span className="text-slate-400 text-[10px] normal-case font-normal">(multi-select)</span></label>
              <div className="flex gap-2">
                {["20FT","40FT","45FT"].map(t=>{
                  const sel=newChassis.tip.includes(t);
                  return(
                    <button key={t} type="button" onClick={()=>setNewChassis(p=>({...p,tip:sel?p.tip.filter(x=>x!==t):[...p.tip,t]}))}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-lg border-2 transition-all ${sel?"border-blue-500 bg-blue-50 text-blue-700":"border-slate-200 text-slate-400 hover:border-slate-300"}`}>{t}</button>
                  );
                })}
              </div>
              {newChassis.tip.length===0&&<p className="text-red-500 text-xs mt-1.5">Select at least one type</p>}
            </div>
            <div className="bg-blue-50 rounded-lg p-3 mb-5 text-xs text-blue-500 border border-blue-200">
              New chassis is automatically set to <strong>Available</strong>. Switches to <strong>In Use</strong> when assigned to a container.
            </div>
            <div className="flex gap-3">
              <button className={`${BTN_P} flex-1`} onClick={handleAddChassis}>Save</button>
              <button className={BTN_G} onClick={()=>setShowAddChassis(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="text-base font-bold text-red-600 mb-3">⚠ {confirmDialog.title}</div>
            <div className="text-sm text-slate-500 mb-6 leading-relaxed">{confirmDialog.message}</div>
            <div className="flex gap-3">
              <button className={`${BTN_D} flex-1`} onClick={confirmDialog.onConfirm}>Yes, Delete</button>
              <button className={`${BTN_G} flex-1`} onClick={()=>setConfirmDialog(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Forecast → Container Preview */}
      {forecastPreview && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-emerald-600">Process Container</h2>
                <p className="text-xs text-slate-400 mt-0.5">Review details and select chassis to confirm.</p>
              </div>
              <button className="text-slate-400 hover:text-slate-600 text-2xl leading-none" onClick={()=>{setForecastPreview(null);setForecastPreviewError("");}}>×</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                {[["Container No",forecastPreview.containerNo],["Customer",forecastPreview.musteri],["Port",forecastPreview.liman||"—"],["Container Type",forecastPreview.containerType||"20FT"],["Cargo (KG)",forecastPreview.kg?`${Number(forecastPreview.kg).toLocaleString()} kg`:"—"],["ADR",forecastPreview.adr?"⚠ Yes":"No"]].map(([l,v])=>(
                  <div key={l} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{l}</span>
                    <span className={`text-xs font-bold ${l==="ADR"&&forecastPreview.adr?"text-red-600":"text-slate-700"}`}>{v}</span>
                  </div>
                ))}
              </div>
              <div>
                <label className={LBL}>Select Chassis <span className="text-red-500">*</span></label>
                <select className={`${INP} cursor-pointer ${forecastPreviewError?"border-red-400":""}`} value={forecastPreview.chassisNo||""}
                  onChange={e=>{setForecastPreview(p=>({...p,chassisNo:e.target.value}));setForecastPreviewError("");}}>
                  <option value="">— Select chassis —</option>
                  {musaitChassis.map(ch=>(
                    <option key={ch.id} value={ch.chassisNo}>{ch.chassisNo} · {ch.plakaNo} · {Array.isArray(ch.tip)?ch.tip.join(", "):(ch.tip||"")}</option>
                  ))}
                </select>
                {forecastPreviewError&&<p className="text-red-500 text-xs mt-1.5">⚠ {forecastPreviewError}</p>}
              </div>
              <div>
                <label className={LBL}>Port Departure Date</label>
                <input type="date" className={INP} value={forecastPreview.limanCikis||today()} onChange={e=>setForecastPreview(p=>({...p,limanCikis:e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <button className={`${BTN_S} flex-1`} onClick={handleConfirmForecastToContainer}>Confirm and Process</button>
              <button className={BTN_G} onClick={()=>{setForecastPreview(null);setForecastPreviewError("");}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
