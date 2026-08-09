(function(){
  "use strict";

  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const yen=value=>Math.round(value).toLocaleString("ja-JP")+"円";

  function statusClass(value){
    if(/多数/.test(value)) return "status-many";
    if(/[123１２３]名/.test(value)) return "status-few";
    if(/空き無し|なし|無し/.test(value)) return "status-none";
    return "status-info";
  }

  function initAvailability(config){
    const body=document.getElementById("availabilityBody");
    const message=document.getElementById("availabilityMessage");
    if(!body||!message) return;
    let settled=false;
    const fail=()=>{
      if(settled) return;
      message.textContent="最新の空き状況を読み込めませんでした。お電話でご確認ください。";
      message.className="availability-message";
      body.innerHTML="";
    };
    window.__pdsAvailabilityCallback=response=>{
      try{
        const rows=(response.table?.rows||[]).map(row=>({
          day:row.c?.[0]?.v||"",
          facility:row.c?.[1]?.v||"",
          bath:row.c?.[2]?.v||""
        })).filter(row=>row.day&&row.day!=="曜日");
        if(!rows.length) return fail();
        body.innerHTML=rows.map(row=>`<tr><th>${esc(row.day)}</th><td><span class="status ${statusClass(String(row.facility))}">${esc(row.facility||"要確認")}</span></td><td><span class="status ${statusClass(String(row.bath))}">${esc(row.bath||"要確認")}</span></td></tr>`).join("");
        settled=true;
        message.textContent="店舗の入力表から最新情報を表示しています。見学・利用開始時はお電話でもご確認ください。";
        message.className="availability-message";
      }catch(error){fail();}
    };
    const script=document.createElement("script");
    script.src=`https://docs.google.com/spreadsheets/d/${encodeURIComponent(config.sheetId)}/gviz/tq?gid=${Number(config.gid||0)}&tqx=out:json;responseHandler:__pdsAvailabilityCallback`;
    script.onerror=fail;
    document.body.appendChild(script);
    window.setTimeout(fail,5000);
  }

  function initPrice(config){
    const $=id=>document.getElementById(id);
    const service=$("serviceType");
    if(!service) return;
    const care=$("careLevel"),time=$("timeSlot"),burden=$("burden"),weekly=$("weekly"),transport=$("transport"),lunch=$("lunch"),bath=$("bath");
    const careField=$("careLevelField"),timeField=$("timeSlotField"),weeklyField=$("weeklyField"),bathField=$("bathField");
    const total=$("totalPrice"),breakdown=$("breakdown");

    function calc(){
      const isDaycare=service.value==="daycare";
      [careField,timeField,weeklyField,bathField].forEach(field=>field?.classList.toggle("hidden",!isDaycare));
      const rate=Number(burden.value);
      const visits=isDaycare?Math.round(Number(weekly.value)*4.3):(service.value==="preventive1"?4:8);
      let insurance=0;
      let bathAdjustment=0;
      let monthlyAddOns=0;
      if(isDaycare){
        const slot=config.daycare[time.value];
        insurance=slot.fees[rate][Number(care.value)]*visits;
        if(bath.checked&&!slot.bathIncluded) bathAdjustment=config.bathFee*rate*visits;
        if(!bath.checked&&slot.bathIncluded) bathAdjustment=-config.bathFee*rate*visits;
        insurance+=bathAdjustment;
        monthlyAddOns=Number(config.monthlyAddOns||0)*rate;
        insurance+=monthlyAddOns;
      }else{
        insurance=config.preventive[service.value][rate];
      }
      const lunchFee=lunch.checked?config.lunchFee*visits:0;
      const transportDeduction=Number(transport.value)*config.transportDeduction*rate*visits;
      const sum=Math.max(0,insurance+lunchFee-transportDeduction);
      total.textContent="約 "+yen(sum)+"／月";
      const rows=[
        ["利用区分",service.options[service.selectedIndex].text],
        ...(isDaycare?[["介護度",care.options[care.selectedIndex].text],["利用時間",time.options[time.selectedIndex].text]]:[]),
        ["月の利用回数目安",visits+"回"],
        [isDaycare?"1日分×利用回数":"介護保険分（月額）",yen(insurance-monthlyAddOns)],
        ...(isDaycare?[["月単位の加算目安",yen(monthlyAddOns)]]:[]),
        ["食費目安",yen(lunchFee)],
        ["送迎なしの減算目安",transportDeduction?"−"+yen(transportDeduction):yen(0)]
      ];
      breakdown.innerHTML=rows.map(([key,value])=>`<li><span>${esc(key)}</span><b>${esc(value)}</b></li>`).join("");
    }
    [service,care,time,burden,weekly,transport,lunch,bath].forEach(element=>element?.addEventListener("change",calc));
    calc();
  }

  window.PDSFacilityTools={init(config){initAvailability(config.availability);initPrice(config.pricing);}};
})();
