import { useState, useMemo, useEffect, useCallback } from "react";
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

  const [newContainer, setNewContainer] = useState({
    containerNo: "", chassisNo: "", musteri: "", limanCikis: today(), containerType: "20FT", kg: "", adr: false,
  });
  const [newHareket, setNewHareket] = useState({
    tarih: today(), surucu: "", konum: "", aciklama: "", km: "", firma: "", referans: "", yukDurumu: "loaded", yukNotu: "",
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
  const nextId = (prefix, list) => {
    const nums = list.map(x => parseInt(x.id.replace(prefix + "-", "")) || 0);
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `${prefix}-${String(max + 1).padStart(3, "0")}`;
  };

  const SURCHARGE_TIPLERI = {
    custom_stop: { label: "🛑 Custom Stop", color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
    bekleme:     { label: "⏱ Waiting",      color: "#d97706", bg: "#fef3c7", border: "#fcd34d" },
    yakit:       { label: "⛽ Fuel Surcharge",     color: "#059669", bg: "#d1fae5", border: "#6ee7b7" },
    diger:       { label: "📎 Other",        color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd" },
  };

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

  const downloadCSV = (rows, headers, filename) => {
    const bom = "\uFEFF";
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportHareketlerCSV = () => {
    const headers = ["Date","Container No","Customer","Driver","Location/Route","KM","Company","Reference","Load Status","Surcharge (TL)","Load Note"];
    const rows = filteredHareketler.map(h => [
      h.tarih, h.containerNo, h.musteri, h.surucu || "", h.konum || "",
      h.km || 0, h.firma || "", h.referans || "",
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
    const style = `<style>body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;padding:20px}h2{font-size:15px;color:#1d6abf;margin-bottom:4px}p{color:#64748b;font-size:10px;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#f1f5f9;color:#475569;font-size:9px;text-transform:uppercase;letter-spacing:1px;padding:7px 10px;border:1px solid #e2e8f0;text-align:left}td{padding:7px 10px;border:1px solid #e2e8f0;font-size:10px}tr:nth-child(even) td{background:#f8fafc}.badge{padding:2px 8px;border-radius:2px;font-weight:700;font-size:9px}.aktif{background:#d1fae5;color:#059669}.kapali{background:#f1f5f9;color:#94a3b8}@media print{body{padding:0}}</style>`;
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
    if (!newHareket.surucu || !newHareket.konum) return;
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
    setNewHareket({ tarih: today(), surucu: "", konum: "", aciklama: "", km: "", firma: "", referans: "", yukDurumu: "loaded", yukNotu: "" });
    setSurchargeLines([]);
    setNewSurcharge({ tip: "custom_stop", aciklama: "", tutar: "", saat: "", saatUcreti: "" });
    setShowAddHareket(false);
  };

  const handleSaveEditHareket = async () => {
    if (!editHareket.surucu || !editHareket.konum) return;
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

  // Supabase henüz yapılandırılmamışsa kurulum ekranı göster
  if (!isConfigured) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Roboto', sans-serif", padding: 24 }}>
        <div style={{ maxWidth: 540, width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⬡</div>
          <div style={{ fontWeight: 900, fontSize: 28, letterSpacing: 4, color: "#fff", marginBottom: 4 }}>CARGO<span style={{ color: "#3b82f6" }}>TRACK</span></div>
          <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 3, marginBottom: 32, textTransform: "uppercase" }}>Container Planning System</div>
          <div style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 8, padding: "20px", marginBottom: 28, textAlign: "left" }}>
            <div style={{ color: "#fbbf24", fontWeight: 700, fontSize: 13, marginBottom: 12 }}>&#9888; Supabase Yapilandirmasi Gerekli</div>
            <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.8 }}>
              src/supabase.js dosyasini acin ve su iki degeri doldurun:
              <div style={{ marginTop: 12, background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "12px 14px", fontFamily: "monospace", fontSize: 11, color: "#6ee7b7" }}>
                <div>{"const SUPABASE_URL = "}<span style={{ color: "#fcd34d" }}>{"'https://xxxx.supabase.co'"}</span>{";"}</div>
                <div style={{ marginTop: 4 }}>{"const SUPABASE_ANON_KEY = "}<span style={{ color: "#fcd34d" }}>{"'eyJhbGci...'"}</span>{";"}</div>
              </div>
              <div style={{ marginTop: 12, color: "#64748b", fontSize: 11 }}>
                Bu degerleri supabase.com - Settings - API bolumunden alabilirsiniz. Detayli rehber icin SUPABASE-SETUP.md dosyasina bakin.
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ background: "#1d6abf", color: "#fff", borderRadius: 6, padding: "11px", fontWeight: 700, fontSize: 12, letterSpacing: 1, textDecoration: "none", textTransform: "uppercase", display: "block" }}>
              1. Supabase Ac
            </a>
            <a href="https://github.com" target="_blank" rel="noreferrer" style={{ background: "rgba(255,255,255,0.08)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "11px", fontWeight: 700, fontSize: 12, letterSpacing: 1, textDecoration: "none", textTransform: "uppercase", display: "block" }}>
              2. Kodu Guncelle
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Roboto', sans-serif", background: "#f0f4f8", minHeight: "100vh", color: "#1e293b", boxShadow: "none" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f0f4f8; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #ffffff; } ::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 3px; }
        .nav-btn { background: none; border: none; cursor: pointer; padding: 10px 20px; font-family: 'Roboto', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; transition: all 0.2s; }
        .nav-btn.active { background: #dbeafe; color: #1d6abf; border-bottom: 2px solid #1d6abf; }
        .nav-btn:not(.active) { color: #94a3b8; }
        .nav-btn:not(.active):hover { color: #64748b; }
        .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .stat-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .btn { cursor: pointer; font-family: 'Roboto', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; padding: 9px 18px; border-radius: 3px; border: none; transition: all 0.2s; }
        .btn-primary { background: #dbeafe; color: #1d6abf; border: 1px solid #93c5fd; }
        .btn-primary:hover { background: #bfdbfe; }
        .btn-danger { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
        .btn-danger:hover { background: #fecaca; }
        .btn-success { background: #d1fae5; color: #059669; border: 1px solid #6ee7b7; }
        .btn-success:hover { background: #a7f3d0; }
        .btn-ghost { background: none; color: #64748b; border: 1px solid #d1d5db; }
        .btn-ghost:hover { background: #f1f5f9; color: #374151; }
        .input { background: #ffffff; border: 1px solid #d1d9e0; color: #1e293b; padding: 9px 12px; border-radius: 3px; font-family: 'Roboto', sans-serif; font-size: 12px; width: 100%; outline: none; transition: border 0.2s; }
        .input:focus { border-color: #3b82f6; }
        .input::placeholder { color: #cbd5e1; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 2px; font-family: 'Roboto', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .badge-active { background: #d1fae5; color: #059669; border: 1px solid #6ee7b7; }
        .badge-closed { background: #f1f5f9; color: #94a3b8; border: 1px solid #d1d5db; }
        .table-row { border-bottom: 1px solid #e2e8f0; transition: background 0.15s; cursor: pointer; }
        .table-row:hover { background: #f8fafc; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 28px; width: 480px; max-width: 95vw; box-shadow: 0 10px 40px rgba(0,0,0,0.12); }
        .hareket-row { border-left: 2px solid #3b82f6; padding: 10px 14px; margin-bottom: 8px; background: #f8fafc; border-radius: 0 3px 3px 0; }
        .hareket-row:last-child { border-left-color: #059669; }
        .detail-panel { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "0 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ padding: "16px 0" }}>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: 4, color: "#1d6abf", textTransform: "uppercase" }}>
              ⬡ CARGO<span style={{ color: "#1e293b" }}>TRACK</span>
            </div>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: "#64748b", letterSpacing: 2 }}>CONTAINER PLANNING SYSTEM</div>
          </div>
          <nav style={{ display: "flex", gap: 4, marginLeft: 16 }}>
            {[["dashboard", "🏠 Dashboard"], ["forecast", "📋 Forecast"], ["liste", "📦 Containers"], ["hareketler", "🚛 Movements"], ["ayarlar", "⚙️ Settings"]].map(([key, label]) => (
              <button key={key} className={`nav-btn ${activeTab === key ? "active" : ""}`} onClick={() => { setActiveTab(key); setSelectedContainer(null); }}>{label}</button>
            ))}
          </nav>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            {currentUser && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{currentUser.name}</div>
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase" }}>{currentUser.role}</div>
                </div>
                <button
                  onClick={onLogout}
                  style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 3, padding: "6px 12px", cursor: "pointer", fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: 1, textTransform: "uppercase" }}
                  title="Sign out"
                >
                  Sign Out
                </button>
              </div>
            )}
            <button className="btn btn-primary" onClick={() => setShowAddContainer(true)}>+ New Container</button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        {/* DB LOADING OVERLAY */}
        {dbLoading && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
            <div style={{ fontSize: 40, marginBottom: 16, animation: "spin 1.2s linear infinite" }}>⬡</div>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 3, color: "#1d6abf", textTransform: "uppercase" }}>Loading data...</div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* DB ERROR BANNER */}
        {dbError && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 4, padding: "14px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 13, color: "#dc2626", fontWeight: 700 }}>Database Connection Error</div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#b91c1c", marginTop: 2 }}>{dbError}</div>
              </div>
            </div>
            <button onClick={fetchAll} style={{ background: "#dc2626", border: "none", borderRadius: 3, padding: "7px 14px", color: "#fff", fontFamily: "'Roboto', sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>Retry</button>
          </div>
        )}

      {/* SUCCESS BANNER */}
        {successMessage && (
          <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 4, padding: "12px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 13, color: "#059669", fontWeight: 600 }}>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#059669", fontSize: 16, fontWeight: 700 }}>✕</button>
          </div>
        )}

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <div>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 300, fontSize: 11, letterSpacing: 3, color: "#64748b", textTransform: "uppercase", marginBottom: 20 }}>
              SİSTEM DURUMU — {new Date().toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
              {[
                { label: "Aktif Container", value: aktifler.length, color: "#1d6abf", sub: "Şu an sahada" },
                { label: "Completed", value: kapalilar.length, color: "#059669", sub: "Bu ay" },
                { label: "Total Days", value: aktifler.reduce((s, c) => s + gunFarki(c.limanCikis, null), 0), color: "#d97706", sub: "Sum of active durations" },
                { label: "Beklenen Container", value: forecastList.length, color: "#7c3aed", sub: "Forecast listesi" },
              ].map(({ label, value, color, sub }) => (
                <div key={label} className="stat-card">
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 900, fontSize: 44, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: "#64748b", marginTop: 6 }}>{sub}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
                Aktif Containerlar
              </div>
              {aktifler.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: "30px 0", fontFamily: "'Roboto', sans-serif", fontSize: 12 }}>Aktif container bulunmuyor</div>
              ) : (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 0.8fr 0.8fr auto", gap: 8, padding: "6px 12px", fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0", marginBottom: 4 }}>
                    <span>Container No</span><span>Chassis</span><span>Customer</span><span>Departure</span><span>Days</span><span>Last Location</span><span></span>
                  </div>
                  {aktifler.map(c => (
                    <div key={c.id} className="table-row" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 0.8fr 0.8fr auto", gap: 8, padding: "12px", alignItems: "center" }}
                      onClick={() => { setSelectedContainer(c); setActiveTab("detay"); }}>
                      <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#1d6abf" }}>{c.containerNo}</span>
                      <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#64748b" }}>{c.chassisNo}</span>
                      <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 13, fontWeight: 500 }}>{c.musteri}</span>
                      <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#94a3b8" }}>{c.limanCikis}</span>
                      <span style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 16, color: gunFarki(c.limanCikis) > 14 ? "#dc2626" : "#d97706" }}>
                        {gunFarki(c.limanCikis)}
                      </span>
                      <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.hareketler[c.hareketler.length - 1]?.konum?.split("→").pop()?.trim() || "-"}
                      </span>
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }}
                        onClick={e => { e.stopPropagation(); setSelectedContainer(c); setActiveTab("detay"); }}>Detail →</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {forecastList.length > 0 && (
              <div className="card" style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, color: "#94a3b8", textTransform: "uppercase" }}>
                    Upcoming Containers (Forecast)
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 12px" }} onClick={() => setActiveTab("forecast")}>View All →</button>
                </div>
                {[...forecastList].sort((a, b) => new Date(a.tahminiTarih) - new Date(b.tahminiTarih)).slice(0, 3).map(fc => {
                  const gunKaldi = gunFarki(today(), fc.tahminiTarih);
                  const gecti = new Date(fc.tahminiTarih) < new Date();
                  const linked = containers.find(c => c.containerNo === fc.containerNo);
                  return (
                    <div key={fc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                        <span
                          style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#1d6abf", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
                          onClick={() => { if (linked) { setSelectedContainer(linked); setActiveTab("detay"); } else { setActiveTab("forecast"); } }}
                          title={linked ? "Go to container detail" : "Forecast sekmesine git"}>
                          {fc.containerNo}
                          {linked && <span style={{ fontSize: 9, marginLeft: 4, color: "#059669", fontWeight: 400 }}>↗</span>}
                        </span>
                        <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 13, color: "#1e293b" }}>{fc.musteri}</span>
                        {fc.liman && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#94a3b8" }}>{fc.liman}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#64748b" }}>{fc.tahminiTarih}</span>
                        <span style={{
                          fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 12, padding: "1px 8px", borderRadius: 2,
                          background: gecti ? "#fee2e2" : gunKaldi <= 3 ? "#fef3c7" : "#dbeafe",
                          color: gecti ? "#dc2626" : gunKaldi <= 3 ? "#d97706" : "#1d6abf",
                        }}>
                          {gecti ? `${Math.abs(gunKaldi)}g geçti` : gunKaldi === 0 ? "Today" : `${gunKaldi}g`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {forecastList.length === 0 && (
              <div className="card" style={{ marginTop: 16, textAlign: "center", padding: "28px 20px" }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 13, letterSpacing: 2, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>
                  Upcoming Containers (Forecast)
                </div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 28, color: "#e2e8f0", marginBottom: 6 }}>📋</div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 12, color: "#cbd5e1" }}>No upcoming containers</div>
                <button className="btn btn-ghost" style={{ marginTop: 12, fontSize: 10, padding: "5px 14px" }} onClick={() => setActiveTab("forecast")}>+ Add Forecast</button>
              </div>
            )}
          </div>
        )}

        {activeTab === "forecast" && (
          <div>
            {/* FILTER BAR */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 200px" }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Container No</div>
                <input className="input" placeholder="Filter..." value={forecastFilter.containerNo}
                  onChange={e => setForecastFilter(p => ({ ...p, containerNo: e.target.value }))} />
              </div>
              <div style={{ flex: "0 0 180px" }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Customer</div>
                <input className="input" placeholder="Customer name..." value={forecastFilter.musteri}
                  onChange={e => setForecastFilter(p => ({ ...p, musteri: e.target.value }))} />
              </div>
              <div style={{ flex: "0 0 140px" }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Est. Date From</div>
                <input type="date" className="input" value={forecastFilter.tarihBas}
                  onChange={e => setForecastFilter(p => ({ ...p, tarihBas: e.target.value }))} />
              </div>
              <div style={{ flex: "0 0 140px" }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Est. Date To</div>
                <input type="date" className="input" value={forecastFilter.tarihBit}
                  onChange={e => setForecastFilter(p => ({ ...p, tarihBit: e.target.value }))} />
              </div>
              {(forecastFilter.containerNo || forecastFilter.musteri || forecastFilter.tarihBas || forecastFilter.tarihBit) && (
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: "7px 12px", alignSelf: "flex-end" }}
                  onClick={() => setForecastFilter({ containerNo: "", musteri: "", tarihBas: "", tarihBit: "" })}>✕ Clear</button>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignSelf: "flex-end" }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#94a3b8", alignSelf: "center", marginRight: 4 }}>
                  {filteredForecast.length} records
                </div>
                <button className="btn btn-primary" style={{ fontSize: 11, padding: "7px 16px" }} onClick={() => setShowAddForecast(true)}>+ Add Forecast</button>
              </div>
            </div>
            {filteredForecast.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 32, color: "#d1d5db", marginBottom: 8 }}>📋</div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 12, color: "#94a3b8" }}>
                  {forecastList.length === 0 ? "No forecast records yet" : "No records match the filter criteria"}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredForecast.map(fc => {
                  const gunKaldi = gunFarki(today(), fc.tahminiTarih);
                  const gecti = new Date(fc.tahminiTarih) < new Date();
                  return (
                    <div key={fc.id} className="card" style={{ padding: "16px 20px", borderLeft: `3px solid ${fc.onem === "high" ? "#dc2626" : fc.onem === "urgent" ? "#7c3aed" : "#3b82f6"}` }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1fr 1fr 1fr auto", gap: 12, alignItems: "center" }}>
                        <div>
                          <div
                            style={{ fontFamily: "'Roboto', sans-serif", fontSize: 12, color: "#1d6abf", fontWeight: 700, cursor: containers.some(c => c.containerNo === fc.containerNo) ? "pointer" : "default", textDecoration: containers.some(c => c.containerNo === fc.containerNo) ? "underline" : "none" }}
                            onClick={() => { const c = containers.find(x => x.containerNo === fc.containerNo); if (c) { setSelectedContainer(c); setActiveTab("detay"); } }}
                            title={containers.some(c => c.containerNo === fc.containerNo) ? "Go to container detail" : "Not yet in system"}>
                            {fc.containerNo}
                            {containers.some(c => c.containerNo === fc.containerNo) && <span style={{ fontSize: 9, marginLeft: 4, color: "#059669", fontWeight: 400 }}>↗ Detail</span>}
                          </div>
                          {fc.aciklama && <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{fc.aciklama}</div>}
                        </div>
                        <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 14, fontWeight: 500, color: "#1e293b" }}>{fc.musteri}</div>
                        <div>
                          <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 1, color: "#94a3b8", textTransform: "uppercase" }}>Port</div>
                          <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#475569" }}>{fc.liman || "—"}</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 1, color: "#94a3b8", textTransform: "uppercase" }}>Est. Date</div>
                          <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#475569" }}>{fc.tahminiTarih}</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 1, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Time</div>
                          <span style={{
                            fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 13, padding: "2px 10px", borderRadius: 2,
                            background: gecti ? "#fee2e2" : gunKaldi <= 3 ? "#fef3c7" : "#dbeafe",
                            color: gecti ? "#dc2626" : gunKaldi <= 3 ? "#d97706" : "#1d6abf",
                            border: `1px solid ${gecti ? "#fca5a5" : gunKaldi <= 3 ? "#fcd34d" : "#93c5fd"}`
                          }}>
                            {gecti ? `${Math.abs(gunKaldi)} days overdue` : gunKaldi === 0 ? "Today" : `${gunKaldi} days left`}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-success" style={{ fontSize: 10, padding: "5px 10px", whiteSpace: "nowrap" }}
                            onClick={() => handleForecastToContainer(fc)}>→ Open Container</button>
                          <button className="btn btn-ghost" style={{ fontSize: 10, padding: "5px 10px", color: "#dc2626", borderColor: "#fca5a5" }}
                            onClick={() => handleDeleteForecast(fc.id, fc.containerNo)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "liste" && (
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
              <input className="input" placeholder="Search container no, customer or chassis..." style={{ maxWidth: 340 }}
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <div style={{ display: "flex", gap: 6 }}>
                {[["all", "All"], ["active", "Active"], ["closed", "Closed"]].map(([val, label]) => (
                  <button key={val} className={`btn ${filterDurum === val ? "btn-primary" : "btn-ghost"}`}
                    style={{ fontSize: 11, padding: "7px 14px" }} onClick={() => setFilterDurum(val)}>{label}</button>
                ))}
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button className="btn btn-primary" style={{ fontSize: 11, padding: "7px 16px" }}
                  onClick={() => setShowAddContainer(true)}>+ Add Container</button>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: "6px 12px", color: "#059669", borderColor: "#6ee7b7" }}
                  onClick={() => exportContainersCSV()}>⬇ Excel</button>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: "6px 12px", color: "#dc2626", borderColor: "#fca5a5" }}
                  onClick={() => exportPDF("containers")}>🖨 PDF</button>
              </div>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.2fr 1fr 1fr 0.7fr 0.7fr auto", gap: 8, padding: "10px 16px", fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>
                <span>Container No</span><span>Chassis</span><span>Customer</span><span>Departure</span><span>Return</span><span>Days</span><span>Status</span><span></span>
              </div>
              {filteredContainers.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: "40px", fontFamily: "'Roboto', sans-serif", fontSize: 12 }}>Sonuç bulunamadı</div>
              ) : filteredContainers.map(c => (
                <div key={c.id} className="table-row" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.2fr 1fr 1fr 0.7fr 0.7fr auto", gap: 8, padding: "13px 16px", alignItems: "center" }}
                  onClick={() => { setSelectedContainer(c); setActiveTab("detay"); }}>
                  <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#1d6abf" }}>{c.containerNo}</span>
                  <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#64748b" }}>{c.chassisNo}</span>
                  <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 14, fontWeight: 500 }}>{c.musteri}</span>
                  <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#94a3b8" }}>{c.limanCikis}</span>
                  <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#94a3b8" }}>{c.limanGiris || "—"}</span>
                  <span style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 15, color: c.durum === "active" ? "#d97706" : "#94a3b8" }}>
                    {gunFarki(c.limanCikis, c.limanGiris)}
                  </span>
                  <span><span className={`badge badge-${c.durum}`}>{c.durum === "active" ? "Active" : "Closed"}</span></span>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }}
                    onClick={e => { e.stopPropagation(); setSelectedContainer(c); setActiveTab("detay"); }}>Detail →</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "hareketler" && (
          <div>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 300, fontSize: 11, letterSpacing: 3, color: "#64748b", textTransform: "uppercase", marginBottom: 16 }}>
              All Movement Records
            </div>

            {/* FILTER BAR */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 200px" }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Container No / Customer</div>
                <input className="input" placeholder="Filter..." value={hareketFilter.containerNo}
                  onChange={e => setHareketFilter(p => ({ ...p, containerNo: e.target.value }))} />
              </div>
              <div style={{ flex: "0 0 160px" }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Sürücü</div>
                <input className="input" placeholder="Driver name..." value={hareketFilter.surucu}
                  onChange={e => setHareketFilter(p => ({ ...p, surucu: e.target.value }))} />
              </div>
              <div style={{ flex: "0 0 140px" }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Start Date</div>
                <input type="date" className="input" value={hareketFilter.tarihBas}
                  onChange={e => setHareketFilter(p => ({ ...p, tarihBas: e.target.value }))} />
              </div>
              <div style={{ flex: "0 0 140px" }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>End Date</div>
                <input type="date" className="input" value={hareketFilter.tarihBit}
                  onChange={e => setHareketFilter(p => ({ ...p, tarihBit: e.target.value }))} />
              </div>
              {(hareketFilter.containerNo || hareketFilter.surucu || hareketFilter.tarihBas || hareketFilter.tarihBit) && (
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: "7px 12px", alignSelf: "flex-end" }}
                  onClick={() => setHareketFilter({ containerNo: "", surucu: "", tarihBas: "", tarihBit: "" })}>✕ Clear</button>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignSelf: "flex-end" }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#94a3b8", alignSelf: "center", marginRight: 4 }}>
                  {filteredHareketler.length} records
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: "6px 12px", color: "#059669", borderColor: "#6ee7b7" }}
                  onClick={() => exportHareketlerCSV()}>⬇ Excel</button>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: "6px 12px", color: "#dc2626", borderColor: "#fca5a5" }}
                  onClick={() => exportPDF("hareketler")}>🖨 PDF</button>
              </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr 1fr 1.1fr 2fr 0.7fr 0.9fr 0.8fr 0.9fr", gap: 6, padding: "10px 16px", fontFamily: "'Roboto', sans-serif", fontSize: 9, letterSpacing: 1.5, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>
                <span>Date</span><span>Container</span><span>Customer</span><span>Driver</span><span>Location / Route</span><span>KM</span><span>Company</span><span>Load</span><span>Surcharge</span>
              </div>
              {filteredHareketler.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: "40px", fontFamily: "'Roboto', sans-serif", fontSize: 12 }}>No records match the filter criteria</div>
              ) : filteredHareketler.map((h, i) => {
                const ekUcret = (h.surcharges || []).reduce((s, sc) => s + (Number(sc.tutar) || 0), 0);
                return (
                  <div key={i} className="table-row" style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr 1fr 1.1fr 2fr 0.7fr 0.9fr 0.8fr 0.9fr", gap: 6, padding: "11px 16px", alignItems: "center" }}
                    onClick={() => { const c = containers.find(x => x.containerId === h.containerId || x.containerNo === h.containerNo); if (c) { setSelectedContainer(c); setActiveTab("detay"); } }}>
                    <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#94a3b8" }}>{h.tarih}</span>
                    <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#1d6abf", fontWeight: 700, cursor: "pointer" }}
                      onClick={e => { e.stopPropagation(); const c = containers.find(x => x.containerNo === h.containerNo); if (c) { setSelectedContainer(c); setActiveTab("detay"); } }}>
                      {h.containerNo}
                    </span>
                    <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#475569" }}>{h.musteri}</span>
                    <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11 }}>{h.surucu}</span>
                    <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: "#64748b" }}>{h.konum}</span>
                    <span style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 12, color: h.km ? "#d97706" : "#64748b" }}>
                      {h.km ? `${Number(h.km).toLocaleString("en-US")}` : "—"}
                    </span>
                    <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#7c3aed" }}>{h.firma || "—"}</span>
                    <span>
                      {h.yukDurumu === "loaded" && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, fontWeight: 700, background: "#dbeafe", color: "#1d6abf", padding: "1px 6px", borderRadius: 2 }}>Dolu</span>}
                      {h.yukDurumu === "empty" && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, fontWeight: 700, background: "#f1f5f9", color: "#475569", padding: "1px 6px", borderRadius: 2 }}>Bos</span>}
                      {h.yukDurumu === "chassis-only" && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, fontWeight: 700, background: "#fef3c7", color: "#d97706", padding: "1px 6px", borderRadius: 2 }}>Chassis</span>}
                      {!h.yukDurumu && <span style={{ color: "#cbd5e1", fontSize: 9 }}>—</span>}
                    </span>
                    <span style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 11, color: ekUcret > 0 ? "#dc2626" : "#94a3b8" }}>
                      {ekUcret > 0 ? `${ekUcret.toLocaleString("en-US")} ₺` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "detay" && selectedContainer && (() => {
          const c = containers.find(x => x.id === selectedContainer.id) || selectedContainer;
          return (
            <div>
              <button className="btn btn-ghost" style={{ marginBottom: 20, fontSize: 11 }} onClick={() => { setActiveTab("liste"); setSelectedContainer(null); }}>← Geri</button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div>
                        <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 18, color: "#1d6abf", fontWeight: 700 }}>{c.containerNo}</div>
                        <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#64748b", marginTop: 4 }}>{c.id}</div>
                      </div>
                      <span className={`badge badge-${c.durum}`}>{c.durum === "active" ? "Active" : "Closed"}</span>
                    </div>
                    {[
                      ["Customer", c.musteri],
                      ["Chassis No", c.chassisNo],
                      ["Container Type", c.containerType || "—"],
                      ["Cargo Weight", c.kg ? `${Number(c.kg).toLocaleString("en-US")} kg` : "—"],
                      ["ADR", c.adr ? "⚠ Yes" : "No"],
                      ["Port Departure", c.limanCikis],
                      ["Port Return", c.limanGiris || "—"],
                      ["Total Days", `${gunFarki(c.limanCikis, c.limanGiris)} days`],
                      ["Total KM", `${totalKm(c.hareketler).toLocaleString("en-US")} km`],
                      ["Movement Count", `${c.hareketler.length} records`],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e2e8f0" }}>
                        <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, letterSpacing: 1.5, color: "#64748b", textTransform: "uppercase" }}>{label}</span>
                        <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: label === "ADR" && c.adr ? "#dc2626" : "#1e293b", fontWeight: label === "ADR" && c.adr ? 700 : 400 }}>{value}</span>
                      </div>
                    ))}
                  </div>
                  {c.durum === "active" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setShowAddHareket(true)}>+ Add Movement</button>
                      <button className="btn btn-danger" style={{ width: "100%" }} onClick={() => setShowKapatModal(true)}>⬡ Return to Port / Kapat</button>
                    </div>
                  )}
                  {c.durum === "closed" && (
                    <div className="card" style={{ background: "#ecfdf5", borderColor: "#6ee7b7" }}>
                      <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, letterSpacing: 2, color: "#059669", textTransform: "uppercase", marginBottom: 8 }}>✓ Operation Complete</div>
                      <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#94a3b8" }}>
                        Toplam {gunFarki(c.limanCikis, c.limanGiris)} günlük işlem tamamlandı ve faturalandırıldı.
                      </div>
                    </div>
                  )}
                </div>

                <div className="card">
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 2, color: "#94a3b8", textTransform: "uppercase", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Movement History</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      {surchargeToplamTumu(c.hareketler) > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: "#64748b", fontWeight: 400, letterSpacing: 0 }}>ek ücret</span>
                          <span style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 18, color: "#dc2626" }}>
                            {surchargeToplamTumu(c.hareketler).toLocaleString("en-US")} ₺
                          </span>
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: "#64748b", fontWeight: 400, letterSpacing: 0 }}>total mesafe</span>
                        <span style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 900, fontSize: 20, color: "#059669" }}>
                          {totalKm(c.hareketler).toLocaleString("en-US")} km
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(() => {
                      const reversed = [...c.hareketler].reverse();
                      const total = totalKm(c.hareketler);
                      let cumulative = total;
                      return reversed.map((h, i) => {
                        const rowKm = Number(h.km) || 0;
                        const kmAtPoint = cumulative;
                        cumulative -= rowKm;
                        return (
                          <div key={i} className="hareket-row" style={{ borderLeftColor: i === 0 ? "#059669" : "#3b82f6" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: "#1d6abf" }}>{h.tarih}</span>
                                {/* YÜK DURUMU BADGE */}
                                {h.yukDurumu === "loaded" && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, fontWeight: 700, background: "#dbeafe", color: "#1d6abf", padding: "1px 7px", borderRadius: 2 }}>📦 Dolu</span>}
                                {h.yukDurumu === "empty" && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, fontWeight: 700, background: "#f1f5f9", color: "#475569", padding: "1px 7px", borderRadius: 2 }}>⬜ Boş</span>}
                                {h.yukDurumu === "chassis-only" && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, fontWeight: 700, background: "#fef3c7", color: "#d97706", padding: "1px 7px", borderRadius: 2 }}>🚛 Chassis</span>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 12, color: "#64748b" }}>{h.surucu}</span>
                                {c.durum === "active" && (
                                  <button onClick={() => {
                                    const realIdx = c.hareketler.length - 1 - i;
                                    setEditHareketIdx(realIdx);
                                    setEditHareket({ ...h });
                                    setEditSurchargeLines(h.surcharges || []);
                                    setEditNewSurcharge({ tip: "custom_stop", aciklama: "", tutar: "", saat: "", saatUcreti: "" });
                                  }} style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 3, color: "#1d6abf", fontSize: 10, fontWeight: 600, padding: "1px 8px", cursor: "pointer", fontFamily: "'Roboto', sans-serif" }}>
                                    ✏ Düzenle
                                  </button>
                                )}
                              </div>
                            </div>
                            <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#1e293b", marginBottom: 4 }}>{h.konum}</div>
                            {h.yukDurumu === "chassis-only" && h.yukNotu && (
                              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#d97706", background: "#fef9c3", border: "1px solid #fcd34d", borderRadius: 2, padding: "2px 8px", marginBottom: 4 }}>📋 {h.yukNotu}</div>
                            )}
                            {(h.firma || h.referans) && (
                              <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
                                {h.firma && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 12, color: "#7c3aed", background: "#ede9fe", border: "1px solid #c4b5fd", padding: "1px 8px", borderRadius: 2 }}>{h.firma}</span>}
                                {h.referans && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: "#94a3b8", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "1px 8px", borderRadius: 2 }}>REF: {h.referans}</span>}
                              </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              {h.aciklama && <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#64748b" }}>{h.aciklama}</div>}
                              {rowKm > 0 && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                                  <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: "#64748b" }}>this route</span>
                                  <span style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 13, color: "#d97706", background: "#fef3c7", border: "1px solid #fcd34d", padding: "1px 8px", borderRadius: 2 }}>{rowKm.toLocaleString("en-US")} km</span>
                                  <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: "#64748b" }}>total</span>
                                  <span style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 13, color: "#059669", background: "#ecfdf5", border: "1px solid #6ee7b7", padding: "1px 8px", borderRadius: 2 }}>{kmAtPoint.toLocaleString("en-US")} km</span>
                                </div>
                              )}
                            </div>
                            {(h.surcharges || []).length > 0 && (
                              <div style={{ marginTop: 8, borderTop: "1px dashed #e2e8f0", paddingTop: 8 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                  <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Surcharges</div>
                                  <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 13, color: "#dc2626", background: "#fee2e2", border: "1px solid #fca5a5", padding: "2px 10px", borderRadius: 2 }}>
                                    Total: {surchargeToplamHareket(h).toLocaleString("en-US")} ₺
                                  </div>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  {h.surcharges.map((sc, si) => {
                                    const tip = SURCHARGE_TIPLERI[sc.tip] || SURCHARGE_TIPLERI.diger;
                                    return (
                                      <div key={si} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: tip.bg, border: `1px solid ${tip.border}`, borderRadius: 3, padding: "4px 10px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                          <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, fontWeight: 600, color: tip.color }}>{tip.label}</span>
                                          {sc.aciklama && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#64748b" }}>{sc.aciklama}</span>}
                                          {sc.tip === "waiting" && sc.saat && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#94a3b8" }}>{sc.saat} saat × {Number(sc.saatUcreti).toLocaleString("en-US")} ₺</span>}
                                        </div>
                                        <span style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 13, color: tip.color }}>{Number(sc.tutar).toLocaleString("en-US")} ₺</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === "ayarlar" && (
          <div>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 300, fontSize: 11, letterSpacing: 3, color: "#64748b", textTransform: "uppercase", marginBottom: 20 }}>
              Definitions / Chassis Management
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Total Chassis", value: chassisWithDurum.length, color: "#1d6abf" },
                { label: "Available", value: chassisWithDurum.filter(c => c.durum === "available").length, color: "#059669" },
                { label: "In Use", value: chassisWithDurum.filter(c => c.durum === "in-use").length, color: "#d97706" },
              ].map(({ label, value, color }) => (
                <div key={label} className="stat-card">
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 900, fontSize: 44, color, lineHeight: 1 }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, color: "#94a3b8", textTransform: "uppercase" }}>Chassis List</div>
                <button className="btn btn-primary" style={{ fontSize: 11, padding: "6px 14px" }} onClick={() => setShowAddChassis(true)}>+ Add Chassis</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr 1fr auto", gap: 8, padding: "10px 16px", fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>
                <span>Chassis No</span><span>Plate No</span><span>Type</span><span>Status</span><span></span>
              </div>
              {chassisWithDurum.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: "40px", fontFamily: "'Roboto', sans-serif", fontSize: 12 }}>Henüz chassis eklenmedi</div>
              ) : chassisWithDurum.map(ch => {
                const aktifContainer = containers.find(c => c.durum === "active" && c.chassisNo === ch.chassisNo);
                return (
                  <div key={ch.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr 1fr auto", gap: 8, padding: "13px 16px", alignItems: "center", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 12, color: "#1d6abf", fontWeight: 700 }}>{ch.chassisNo}</span>
                    <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#64748b" }}>{ch.plakaNo}</span>
                    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {(Array.isArray(ch.tip) ? ch.tip : ch.tip ? [ch.tip] : []).map(t => (
                        <span key={t} style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, fontWeight: 700, background: "#dbeafe", color: "#1d6abf", padding: "2px 8px", borderRadius: 2 }}>{t}</span>
                      ))}
                    </span>
                    <div>
                      <span style={ch.durum === "available"
                        ? { background: "#d1fae5", color: "#059669", border: "1px solid #6ee7b7", display: "inline-block", padding: "3px 10px", borderRadius: 2, fontFamily: "'Roboto', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }
                        : { background: "#fef3c7", color: "#d97706", border: "1px solid #fcd34d", display: "inline-block", padding: "3px 10px", borderRadius: 2, fontFamily: "'Roboto', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                        {ch.durum === "available" ? "Available" : "In Use"}
                      </span>
                      {aktifContainer && <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: "#64748b", marginTop: 3 }}>{aktifContainer.containerNo}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 10px" }}
                        onClick={() => setEditChassis({ ...ch })}>✏ Edit</button>
                      <button className="btn btn-danger" style={{ fontSize: 10, padding: "4px 10px", opacity: ch.durum === "in-use" ? 0.3 : 1, cursor: ch.durum === "in-use" ? "not-allowed" : "pointer" }}
                        onClick={() => ch.durum !== "in-use" && handleDeleteChassis(ch.id, ch.chassisNo)}
                        title={ch.durum === "in-use" ? "Cannot delete a chassis that is in use" : "Delete"}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Yeni Container */}
      {showAddContainer && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: 3, color: "#1d6abf", textTransform: "uppercase", marginBottom: 20 }}>New Container</div>
            {[["Container No", "containerNo", "MSCU1234567"], ["Customer / Company", "musteri", "Company Name"]].map(([label, key, ph]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
                <input className="input" placeholder={ph} value={newContainer[key]} onChange={e => setNewContainer(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}

            {/* CONTAINER TYPE */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>Container Type</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["20FT", "40FT", "45FT"].map(t => (
                  <button key={t} onClick={() => setNewContainer(p => ({ ...p, containerType: t }))}
                    style={{ flex: 1, padding: "9px 6px", borderRadius: 3, border: `2px solid ${newContainer.containerType === t ? "#1d6abf" : "#e2e8f0"}`, background: newContainer.containerType === t ? "#dbeafe" : "#fff", color: newContainer.containerType === t ? "#1d6abf" : "#94a3b8", fontFamily: "'Roboto', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>
                Select Chassis <span style={{ color: "#dc2626" }}>*</span>
              </div>
              <select className="input" value={newContainer.chassisNo}
                onChange={e => { setNewContainer(p => ({ ...p, chassisNo: e.target.value })); setContainerFormError(""); }}
                style={{ cursor: "pointer", borderColor: containerFormError ? "#dc2626" : undefined }}>
                <option value="">— Chassis seçin —</option>
                {musaitChassis.map(ch => (
                  <option key={ch.id} value={ch.chassisNo}>{ch.chassisNo} · {ch.plakaNo} · {Array.isArray(ch.tip) ? ch.tip.join(", ") : (ch.tip || "")}</option>
                ))}
              </select>
              {containerFormError && <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#dc2626", marginTop: 4 }}>⚠ {containerFormError}</div>}
              {musaitChassis.length === 0 && <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: "#dc2626", marginTop: 4 }}>⚠ Müsait chassis bulunamadı. Ayarlar'dan chassis ekleyin.</div>}
            </div>

            {/* KG + ADR */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>Cargo Weight (KG)</div>
                <input type="number" className="input" placeholder="e.g. 24000" min="0" value={newContainer.kg}
                  onChange={e => setNewContainer(p => ({ ...p, kg: e.target.value }))} style={{ textAlign: "right" }} />
              </div>
              <div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>ADR (Hazardous Goods)</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["No", false], ["Yes", true]].map(([label, val]) => (
                    <button key={label} onClick={() => setNewContainer(p => ({ ...p, adr: val }))}
                      style={{ flex: 1, padding: "9px 6px", borderRadius: 3, border: `2px solid ${newContainer.adr === val ? (val ? "#dc2626" : "#059669") : "#e2e8f0"}`, background: newContainer.adr === val ? (val ? "#fee2e2" : "#d1fae5") : "#fff", color: newContainer.adr === val ? (val ? "#dc2626" : "#059669") : "#94a3b8", fontFamily: "'Roboto', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>Port Departure Date</div>
              <input type="date" className="input" value={newContainer.limanCikis} onChange={e => setNewContainer(p => ({ ...p, limanCikis: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddContainer}>Open Container</button>
              <button className="btn btn-ghost" onClick={() => { setShowAddContainer(false); setContainerFormError(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Hareket Ekle */}
      {showAddHareket && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 560, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 18, color: "#1d6abf", marginBottom: 20 }}>🚛 Add Movement</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {[["Driver", "surucu", "Driver name"], ["Company", "firma", "Company name"]].map(([label, key, ph]) => (
                <div key={key}>
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
                  <input className="input" placeholder={ph} value={newHareket[key]} onChange={e => setNewHareket(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
            </div>

            {/* YÜK DURUMU */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>Container Load Status</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {[
                  { val: "loaded",   label: "📦 Loaded",          bg: "#dbeafe", color: "#1d6abf", border: "#93c5fd" },
                  { val: "empty",    label: "⬜ Empty",           bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
                  { val: "chassis-only",label: "🚛 Chassis Only", bg: "#fef3c7", color: "#d97706", border: "#fcd34d" },
                ].map(opt => (
                  <button key={opt.val} onClick={() => setNewHareket(p => ({ ...p, yukDurumu: opt.val }))}
                    style={{ flex: 1, padding: "8px 6px", borderRadius: 3, border: `2px solid ${newHareket.yukDurumu === opt.val ? opt.color : "#e2e8f0"}`, background: newHareket.yukDurumu === opt.val ? opt.bg : "#fff", color: newHareket.yukDurumu === opt.val ? opt.color : "#94a3b8", fontFamily: "'Roboto', sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {newHareket.yukDurumu === "chassis-only" && (
                <input className="input" placeholder="Note: Which container to pick up, where to go..." value={newHareket.yukNotu} onChange={e => setNewHareket(p => ({ ...p, yukNotu: e.target.value }))} />
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>Location / Route</div>
              <input className="input" placeholder="Start → Destination" value={newHareket.konum} onChange={e => setNewHareket(p => ({ ...p, konum: e.target.value }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              {[["Reference", "referans", "Ref. no"], ["Note", "aciklama", "Note"]].map(([label, key, ph]) => (
                <div key={key}>
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
                  <input className="input" placeholder={ph} value={newHareket[key]} onChange={e => setNewHareket(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>KM</div>
                <input type="number" className="input" placeholder="120" min="0" value={newHareket.km} onChange={e => setNewHareket(p => ({ ...p, km: e.target.value }))} style={{ textAlign: "right" }} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>Date</div>
              <input type="date" className="input" value={newHareket.tarih} onChange={e => setNewHareket(p => ({ ...p, tarih: e.target.value }))} />
            </div>
            <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 16, marginBottom: 12 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>💰 Surcharges (Surcharge)</div>
              {surchargeLines.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {surchargeLines.map((sc, i) => {
                    const tip = SURCHARGE_TIPLERI[sc.tip] || SURCHARGE_TIPLERI.diger;
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: tip.bg, border: `1px solid ${tip.border}`, borderRadius: 3, padding: "6px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, fontWeight: 600, color: tip.color }}>{tip.label}</span>
                          {sc.aciklama && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#64748b" }}>{sc.aciklama}</span>}
                          {sc.tip === "waiting" && sc.saat && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#94a3b8" }}>{sc.saat} saat × {Number(sc.saatUcreti).toLocaleString("en-US")} ₺</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 13, color: tip.color }}>{Number(sc.tutar).toLocaleString("en-US")} ₺</span>
                          <button onClick={() => setSurchargeLines(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 14, lineHeight: 1 }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ textAlign: "right", fontFamily: "'Roboto', sans-serif", fontSize: 12, fontWeight: 700, color: "#dc2626", paddingRight: 4 }}>
                    Total Surcharge: {surchargeLines.reduce((s, sc) => s + (Number(sc.tutar) || 0), 0).toLocaleString("en-US")} ₺
                  </div>
                </div>
              )}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, padding: 12 }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Add New Item</div>
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Tip</div>
                    <select className="input" value={newSurcharge.tip} onChange={e => setNewSurcharge(p => ({ ...p, tip: e.target.value, saat: "", saatUcreti: "", tutar: "" }))} style={{ cursor: "pointer" }}>
                      {Object.entries(SURCHARGE_TIPLERI).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Description</div>
                    <input className="input" placeholder="optional" value={newSurcharge.aciklama} onChange={e => setNewSurcharge(p => ({ ...p, aciklama: e.target.value }))} />
                  </div>
                </div>
                {newSurcharge.tip === "bekleme" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Time (Saat)</div>
                      <input type="number" className="input" placeholder="2" min="0" value={newSurcharge.saat}
                        onChange={e => { const saat = e.target.value; setNewSurcharge(p => ({ ...p, saat, tutar: (Number(saat) * Number(p.saatUcreti)) || "" })); }} style={{ textAlign: "right" }} />
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Hourly Rate (₺)</div>
                      <input type="number" className="input" placeholder="500" min="0" value={newSurcharge.saatUcreti}
                        onChange={e => { const saatUcreti = e.target.value; setNewSurcharge(p => ({ ...p, saatUcreti, tutar: (Number(p.saat) * Number(saatUcreti)) || "" })); }} style={{ textAlign: "right" }} />
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#d97706", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 4 }}>Calculated ₺</div>
                      <input type="number" className="input" placeholder="0" value={newSurcharge.tutar} readOnly style={{ textAlign: "right", background: "#fef3c7", borderColor: "#fcd34d", fontWeight: 700, color: "#d97706" }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Amount (₺)</div>
                    <input type="number" className="input" placeholder="e.g. 1500" min="0" value={newSurcharge.tutar} onChange={e => setNewSurcharge(p => ({ ...p, tutar: e.target.value }))} style={{ textAlign: "right" }} />
                  </div>
                )}
                <button className="btn btn-primary" style={{ width: "100%", fontSize: 12 }}
                  onClick={() => {
                    if (!newSurcharge.tutar || Number(newSurcharge.tutar) <= 0) return;
                    setSurchargeLines(prev => [...prev, { ...newSurcharge }]);
                    setNewSurcharge({ tip: "custom_stop", aciklama: "", tutar: "", saat: "", saatUcreti: "" });
                  }}>+ Add Item to List</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddHareket}>💾 Save Movement</button>
              <button className="btn btn-ghost" onClick={() => { setShowAddHareket(false); setSurchargeLines([]); setNewSurcharge({ tip: "custom_stop", aciklama: "", tutar: "", saat: "", saatUcreti: "" }); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Kapat */}
      {showKapatModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: 3, color: "#dc2626", textTransform: "uppercase", marginBottom: 8 }}>Return to Port</div>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#94a3b8", marginBottom: 20 }}>
              Are you sure you want to close this operation? Billing will be initiated.
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>Port Return Date</div>
              <input type="date" className="input" id="kapatTarih" defaultValue={today()} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleKapat(document.getElementById("kapatTarih").value)}>Close and Bill</button>
              <button className="btn btn-ghost" onClick={() => setShowKapatModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Forecast */}
      {showAddForecast && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: 3, color: "#7c3aed", textTransform: "uppercase", marginBottom: 20 }}>Add Forecast</div>
            {[
              ["Container No", "containerNo", "MSCU1234567"],
              ["Customer / Company", "musteri", "Company Name"],
              ["Port", "liman", "Port name..."],
              ["Description", "aciklama", "Optional note"],
            ].map(([label, key, ph]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
                <input className="input" placeholder={ph} value={newForecast[key]} onChange={e => setNewForecast(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}

            {/* Container Tipi */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>Container Type</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["20FT", "40FT", "45FT"].map(t => (
                  <button key={t} onClick={() => setNewForecast(p => ({ ...p, containerType: t }))}
                    style={{ flex: 1, padding: "8px 6px", borderRadius: 3, border: `2px solid ${newForecast.containerType === t ? "#7c3aed" : "#e2e8f0"}`, background: newForecast.containerType === t ? "#ede9fe" : "#fff", color: newForecast.containerType === t ? "#7c3aed" : "#94a3b8", fontFamily: "'Roboto', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* KG + ADR */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>Cargo Weight (KG)</div>
                <input type="number" className="input" placeholder="e.g. 24000" min="0" value={newForecast.kg}
                  onChange={e => setNewForecast(p => ({ ...p, kg: e.target.value }))} style={{ textAlign: "right" }} />
              </div>
              <div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>ADR</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["No", false], ["Yes", true]].map(([label, val]) => (
                    <button key={label} onClick={() => setNewForecast(p => ({ ...p, adr: val }))}
                      style={{ flex: 1, padding: "8px 6px", borderRadius: 3, border: `2px solid ${newForecast.adr === val ? (val ? "#dc2626" : "#059669") : "#e2e8f0"}`, background: newForecast.adr === val ? (val ? "#fee2e2" : "#d1fae5") : "#fff", color: newForecast.adr === val ? (val ? "#dc2626" : "#059669") : "#94a3b8", fontFamily: "'Roboto', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>Est. Date</div>
                <input type="date" className="input" value={newForecast.tahminiTarih} onChange={e => setNewForecast(p => ({ ...p, tahminiTarih: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>Priority</div>
                <select className="input" value={newForecast.onem} onChange={e => setNewForecast(p => ({ ...p, onem: e.target.value }))} style={{ cursor: "pointer" }}>
                  <option value="normal">Normal</option>
                  <option value="high">Yüksek</option>
                  <option value="urgent">Acil</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddForecast}>Save</button>
              <button className="btn btn-ghost" onClick={() => setShowAddForecast(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Hareket Düzenle */}
      {editHareket && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 560, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 18, color: "#d97706", marginBottom: 20 }}>✏ Edit Movement</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {[["Driver", "surucu", "Driver name"], ["Company", "firma", "Company name"]].map(([label, key, ph]) => (
                <div key={key}>
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
                  <input className="input" placeholder={ph} value={editHareket[key] || ""} onChange={e => setEditHareket(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
            </div>

            {/* YÜK DURUMU - DÜZENLE */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>Container Load Status</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {[
                  { val: "loaded",    label: "📦 Loaded",          bg: "#dbeafe", color: "#1d6abf", border: "#93c5fd" },
                  { val: "empty",     label: "⬜ Empty",           bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
                  { val: "chassis-only", label: "🚛 Chassis Only", bg: "#fef3c7", color: "#d97706", border: "#fcd34d" },
                ].map(opt => (
                  <button key={opt.val} onClick={() => setEditHareket(p => ({ ...p, yukDurumu: opt.val }))}
                    style={{ flex: 1, padding: "8px 6px", borderRadius: 3, border: `2px solid ${(editHareket.yukDurumu || "loaded") === opt.val ? opt.color : "#e2e8f0"}`, background: (editHareket.yukDurumu || "loaded") === opt.val ? opt.bg : "#fff", color: (editHareket.yukDurumu || "loaded") === opt.val ? opt.color : "#94a3b8", fontFamily: "'Roboto', sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {(editHareket.yukDurumu || "loaded") === "chassis-only" && (
                <input className="input" placeholder="Note: Which container to pick up, where to go..." value={editHareket.yukNotu || ""} onChange={e => setEditHareket(p => ({ ...p, yukNotu: e.target.value }))} />
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>Location / Route</div>
              <input className="input" placeholder="Start → Destination" value={editHareket.konum || ""} onChange={e => setEditHareket(p => ({ ...p, konum: e.target.value }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              {[["Reference", "referans", "Ref. no"], ["Note", "aciklama", "Note"]].map(([label, key, ph]) => (
                <div key={key}>
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
                  <input className="input" placeholder={ph} value={editHareket[key] || ""} onChange={e => setEditHareket(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>KM</div>
                <input type="number" className="input" placeholder="120" min="0" value={editHareket.km || ""} onChange={e => setEditHareket(p => ({ ...p, km: e.target.value }))} style={{ textAlign: "right" }} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>Date</div>
              <input type="date" className="input" value={editHareket.tarih || ""} onChange={e => setEditHareket(p => ({ ...p, tarih: e.target.value }))} />
            </div>
            <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 16, marginBottom: 12 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>💰 Surcharges</div>
              {editSurchargeLines.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {editSurchargeLines.map((sc, i) => {
                    const tip = SURCHARGE_TIPLERI[sc.tip] || SURCHARGE_TIPLERI.diger;
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: tip.bg, border: `1px solid ${tip.border}`, borderRadius: 3, padding: "6px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, fontWeight: 600, color: tip.color }}>{tip.label}</span>
                          {sc.aciklama && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#64748b" }}>{sc.aciklama}</span>}
                          {sc.tip === "waiting" && sc.saat && <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#94a3b8" }}>{sc.saat} saat × {Number(sc.saatUcreti).toLocaleString("en-US")} ₺</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 13, color: tip.color }}>{Number(sc.tutar).toLocaleString("en-US")} ₺</span>
                          <button onClick={() => setEditSurchargeLines(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 14 }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ textAlign: "right", fontFamily: "'Roboto', sans-serif", fontSize: 12, fontWeight: 700, color: "#dc2626" }}>
                    Total: {editSurchargeLines.reduce((s, sc) => s + (Number(sc.tutar) || 0), 0).toLocaleString("en-US")} ₺
                  </div>
                </div>
              )}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, padding: 12 }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Add New Item</div>
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Tip</div>
                    <select className="input" value={editNewSurcharge.tip} onChange={e => setEditNewSurcharge(p => ({ ...p, tip: e.target.value, saat: "", saatUcreti: "", tutar: "" }))} style={{ cursor: "pointer" }}>
                      {Object.entries(SURCHARGE_TIPLERI).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Description</div>
                    <input className="input" placeholder="optional" value={editNewSurcharge.aciklama} onChange={e => setEditNewSurcharge(p => ({ ...p, aciklama: e.target.value }))} />
                  </div>
                </div>
                {editNewSurcharge.tip === "bekleme" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Time (Saat)</div>
                      <input type="number" className="input" placeholder="2" min="0" value={editNewSurcharge.saat}
                        onChange={e => { const saat = e.target.value; setEditNewSurcharge(p => ({ ...p, saat, tutar: (Number(saat) * Number(p.saatUcreti)) || "" })); }} style={{ textAlign: "right" }} />
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Hourly Rate (₺)</div>
                      <input type="number" className="input" placeholder="500" min="0" value={editNewSurcharge.saatUcreti}
                        onChange={e => { const saatUcreti = e.target.value; setEditNewSurcharge(p => ({ ...p, saatUcreti, tutar: (Number(p.saat) * Number(saatUcreti)) || "" })); }} style={{ textAlign: "right" }} />
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#d97706", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 4 }}>Calculated ₺</div>
                      <input type="number" className="input" value={editNewSurcharge.tutar} readOnly style={{ textAlign: "right", background: "#fef3c7", borderColor: "#fcd34d", fontWeight: 700, color: "#d97706" }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Amount (₺)</div>
                    <input type="number" className="input" placeholder="e.g. 1500" min="0" value={editNewSurcharge.tutar} onChange={e => setEditNewSurcharge(p => ({ ...p, tutar: e.target.value }))} style={{ textAlign: "right" }} />
                  </div>
                )}
                <button className="btn btn-primary" style={{ width: "100%", fontSize: 12 }}
                  onClick={() => {
                    if (!editNewSurcharge.tutar || Number(editNewSurcharge.tutar) <= 0) return;
                    setEditSurchargeLines(prev => [...prev, { ...editNewSurcharge }]);
                    setEditNewSurcharge({ tip: "custom_stop", aciklama: "", tutar: "", saat: "", saatUcreti: "" });
                  }}>+ Add Item to List</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveEditHareket}>💾 Save Changes</button>
              <button className="btn btn-ghost" onClick={() => { setEditHareketIdx(null); setEditHareket(null); setEditSurchargeLines([]); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Chassis Düzenle */}
      {editChassis && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: 3, color: "#d97706", textTransform: "uppercase", marginBottom: 20 }}>✏ Edit Chassis</div>
            {[["Chassis No", "chassisNo", "CHS-001"], ["Plate No", "plakaNo", "34 ABC 001"]].map(([label, key, ph]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
                <input className="input" placeholder={ph} value={editChassis[key]} onChange={e => setEditChassis(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Chassis Type <span style={{ color: "#94a3b8", textTransform: "none", fontWeight: 400, fontSize: 10 }}>(multi-select)</span></div>
              <div style={{ display: "flex", gap: 8 }}>
                {["20FT", "40FT", "45FT"].map(t => {
                  const arr = Array.isArray(editChassis.tip) ? editChassis.tip : (editChassis.tip ? [editChassis.tip] : []);
                  const sel = arr.includes(t);
                  return (
                    <button key={t} onClick={() => setEditChassis(p => {
                      const cur = Array.isArray(p.tip) ? p.tip : (p.tip ? [p.tip] : []);
                      return { ...p, tip: sel ? cur.filter(x => x !== t) : [...cur, t] };
                    })}
                      style={{ flex: 1, padding: "9px 6px", borderRadius: 3, border: `2px solid ${sel ? "#1d6abf" : "#e2e8f0"}`, background: sel ? "#dbeafe" : "#fff", color: sel ? "#1d6abf" : "#94a3b8", fontFamily: "'Roboto', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      {t}
                    </button>
                  );
                })}
              </div>
              {(Array.isArray(editChassis.tip) ? editChassis.tip : []).length === 0 && <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#dc2626", marginTop: 4 }}>Select at least one type</div>}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveEditChassis}>Save</button>
              <button className="btn btn-ghost" onClick={() => setEditChassis(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Chassis Ekle */}
      {showAddChassis && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: 3, color: "#1d6abf", textTransform: "uppercase", marginBottom: 20 }}>Define New Chassis</div>
            {[["Chassis No", "chassisNo", "CHS-001"], ["Plate No", "plakaNo", "34 ABC 001"]].map(([label, key, ph]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
                <input className="input" placeholder={ph} value={newChassis[key]} onChange={e => setNewChassis(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Chassis Type <span style={{ color: "#94a3b8", textTransform: "none", fontWeight: 400, fontSize: 10 }}>(multi-select)</span></div>
              <div style={{ display: "flex", gap: 8 }}>
                {["20FT", "40FT", "45FT"].map(t => {
                  const sel = newChassis.tip.includes(t);
                  return (
                    <button key={t} onClick={() => setNewChassis(p => ({ ...p, tip: sel ? p.tip.filter(x => x !== t) : [...p.tip, t] }))}
                      style={{ flex: 1, padding: "9px 6px", borderRadius: 3, border: `2px solid ${sel ? "#1d6abf" : "#e2e8f0"}`, background: sel ? "#dbeafe" : "#fff", color: sel ? "#1d6abf" : "#94a3b8", fontFamily: "'Roboto', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      {t}
                    </button>
                  );
                })}
              </div>
              {newChassis.tip.length === 0 && <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#dc2626", marginTop: 4 }}>Select at least one type</div>}
            </div>
            <div style={{ marginBottom: 20, background: "#f0f4f8", border: "1px solid #e2e8f0", borderRadius: 3, padding: "10px 12px" }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 9, color: "#64748b" }}>
                New chassis is automatically set to <span style={{ color: "#059669" }}>Available</span> status. When assigned to a container, it switches to <span style={{ color: "#d97706" }}>In Use</span>.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddChassis}>Save</button>
              <button className="btn btn-ghost" onClick={() => setShowAddChassis(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Onay Dialogu */}
      {confirmDialog && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          <div className="modal" style={{ width: 400 }}>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 16, color: "#dc2626", marginBottom: 12 }}>
              ⚠ {confirmDialog.title}
            </div>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 13, color: "#475569", marginBottom: 24, lineHeight: 1.6 }}>
              {confirmDialog.message}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmDialog.onConfirm}>Evet, Sil</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDialog(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Forecast → Container Önizleme */}
      {forecastPreview && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          <div className="modal" style={{ width: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: 16, color: "#059669", marginBottom: 4 }}>
              Process Container
            </div>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, color: "#94a3b8", marginBottom: 16 }}>
              Review the details below and select a chassis to confirm.
            </div>

            {/* Forecast bilgileri - readonly */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, padding: "12px 16px", marginBottom: 16 }}>
              {[
                ["Container No", forecastPreview.containerNo],
                ["Customer", forecastPreview.musteri],
                ["Port", forecastPreview.liman || "—"],
                ["Container Type", forecastPreview.containerType || "20FT"],
                ["Cargo (KG)", forecastPreview.kg ? `${Number(forecastPreview.kg).toLocaleString("en-US")} kg` : "—"],
                ["ADR", forecastPreview.adr ? "⚠ Yes" : "No"],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
                  <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: 11, fontWeight: 600, color: label === "ADR" && forecastPreview.adr ? "#dc2626" : "#1e293b" }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Chassis seçimi — zorunlu */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>
                Select Chassis <span style={{ color: "#dc2626" }}>*</span>
              </div>
              <select className="input" value={forecastPreview.chassisNo || ""}
                onChange={e => { setForecastPreview(p => ({ ...p, chassisNo: e.target.value })); setForecastPreviewError(""); }}
                style={{ cursor: "pointer", borderColor: forecastPreviewError ? "#dc2626" : undefined }}>
                <option value="">— Chassis seçin —</option>
                {musaitChassis.map(ch => (
                  <option key={ch.id} value={ch.chassisNo}>{ch.chassisNo} · {ch.plakaNo} · {Array.isArray(ch.tip) ? ch.tip.join(", ") : (ch.tip || "")}</option>
                ))}
              </select>
              {forecastPreviewError && <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, color: "#dc2626", marginTop: 4 }}>⚠ {forecastPreviewError}</div>}
            </div>

            {/* Liman çıkış tarihi */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 10, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 5 }}>Port Departure Date</div>
              <input type="date" className="input" value={forecastPreview.limanCikis || today()}
                onChange={e => setForecastPreview(p => ({ ...p, limanCikis: e.target.value }))} />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={handleConfirmForecastToContainer}>Confirm and Process</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setForecastPreview(null); setForecastPreviewError(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}