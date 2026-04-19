const fs = require('fs');
const lines = [];
lines.push("import { ImageResponse } from 'next/og'");
lines.push("import { NextRequest } from 'next/server'");
lines.push("");
lines.push("export const runtime = 'edge'");
lines.push("");
lines.push("export async function GET(request: NextRequest) {");
lines.push("  const { searchParams } = new URL(request.url)");
lines.push("  const dose = parseFloat(searchParams.get('dose') || '0')");
lines.push("  const vial = parseFloat(searchParams.get('vial') || '0')");
lines.push("  const water = parseFloat(searchParams.get('water') || '0')");
lines.push("");
lines.push("  let units = 0, volumeMl = 0, concentration = 0");
lines.push("  if (dose && vial && water) {");
lines.push("    const totalMcg = vial * 1000");
lines.push("    concentration = totalMcg / water");
lines.push("    volumeMl = (dose * 1000) / concentration");
lines.push("    units = volumeMl * 100");
lines.push("  }");
lines.push("");
lines.push("  return new ImageResponse(");
lines.push("    (");
lines.push("      <div style={{display:'flex',flexDirection:'column',width:'100%',height:'100%',background:'#0a0a0f',padding:'60px',fontFamily:'monospace',color:'white'}}>");
lines.push("        <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'40px'}}>");
lines.push("          <span style={{fontSize:'36px',fontWeight:900,color:'#39ff14',letterSpacing:'2px'}}>PROTOCOL</span>");
lines.push("          <span style={{fontSize:'20px',color:'#3d3d5c'}}>Peptide Calculator</span>");
lines.push("        </div>");
lines.push("        {dose > 0 ? (");
lines.push("          <div style={{display:'flex',flexDirection:'column',gap:'24px',flex:1}}>");
lines.push("            <div style={{display:'flex',gap:'40px'}}>");
lines.push("              <div style={{display:'flex',flexDirection:'column'}}>");
lines.push("                <span style={{fontSize:'14px',color:'#3d3d5c',letterSpacing:'2px',marginBottom:'8px'}}>DOSE</span>");
lines.push("                <span style={{fontSize:'48px',fontWeight:900,color:'white'}}>{dose}mg</span>");
lines.push("              </div>");
lines.push("              <div style={{display:'flex',flexDirection:'column'}}>");
lines.push("                <span style={{fontSize:'14px',color:'#3d3d5c',letterSpacing:'2px',marginBottom:'8px'}}>VIAL</span>");
lines.push("                <span style={{fontSize:'48px',fontWeight:900,color:'white'}}>{vial}mg</span>");
lines.push("              </div>");
lines.push("              <div style={{display:'flex',flexDirection:'column'}}>");
lines.push("                <span style={{fontSize:'14px',color:'#3d3d5c',letterSpacing:'2px',marginBottom:'8px'}}>WATER</span>");
lines.push("                <span style={{fontSize:'48px',fontWeight:900,color:'white'}}>{water}mL</span>");
lines.push("              </div>");
lines.push("            </div>");
lines.push("            <div style={{display:'flex',flexDirection:'column',background:'#12121a',border:'2px solid #39ff14',borderRadius:'16px',padding:'32px'}}>");
lines.push("              <span style={{fontSize:'14px',color:'#39ff14',letterSpacing:'2px',marginBottom:'8px'}}>DRAW SYRINGE TO</span>");
lines.push("              <span style={{fontSize:'72px',fontWeight:900,color:'#39ff14'}}>{units.toFixed(1)} units</span>");
lines.push("              <span style={{fontSize:'20px',color:'#8b8ba7',marginTop:'8px'}}>{volumeMl.toFixed(3)} mL · {concentration.toFixed(0)} mcg/mL</span>");
lines.push("            </div>");
lines.push("          </div>");
lines.push("        ) : (");
lines.push("          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1}}>");
lines.push("            <span style={{fontSize:'36px',fontWeight:900,color:'#39ff14',marginBottom:'16px'}}>Peptide Calculator</span>");
lines.push("            <span style={{fontSize:'24px',color:'#8b8ba7'}}>Exact syringe units. No math errors.</span>");
lines.push("          </div>");
lines.push("        )}");
lines.push("        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'24px'}}>");
lines.push("          <span style={{fontSize:'16px',color:'#3d3d5c'}}>mypepprotocol.app/calculator</span>");
lines.push("          <span style={{fontSize:'14px',color:'#39ff14',letterSpacing:'1px'}}>FREE · NO SIGNUP</span>");
lines.push("        </div>");
lines.push("      </div>");
lines.push("    ),");
lines.push("    { width: 1200, height: 630 }");
lines.push("  )");
lines.push("}");
fs.writeFileSync('app/api/og/route.tsx', lines.join('\n'), 'utf8');
console.log('OG route created');

// Now update calculator page to set dynamic meta tags
let calc = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// We can't set meta tags from a client component, so we need a separate metadata approach
// The simplest way: add a generateMetadata in a layout or use the OG route in a server component wrapper

// Actually for OG images we need to set them in the page metadata
// Since calculator is a client component, we need a parent layout
console.log('OG API route done - need to add meta tags via layout');
