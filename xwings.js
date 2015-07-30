var phase=0;
var subphase=0;
var round=1;
var skillturn=0;
var tabskill;
var VERSION="v0.6.1";

var DECLOAK_PHASE=1;
var SETUP_PHASE=2,PLANNING_PHASE=3,ACTIVATION_PHASE=4,COMBAT_PHASE=5,SELECT_PHASE1=0,SELECT_PHASE2=1;
var DICES=["focusred","hitred","criticalred","blankred","focusgreen","evadegreen","blankgreen"];
var BOMBS=[];
var ROCKDATA="";
var allunits=[];

Base64 = {
    _Rixits :
//   0       8       16      24      32      40      48      56     63
//   v       v       v       v       v       v       v       v      v
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_",
    // You have the freedom, here, to choose the glyphs you want for 
    // representing your base-64 numbers. The ASCII encoding guys usually
    // choose a set of glyphs beginning with ABCD..., but, looking at
    // your update #2, I deduce that you want glyphs beginning with 
    // 0123..., which is a fine choice and aligns the first ten numbers
    // in base 64 with the first ten numbers in decimal.

    // This cannot handle negative numbers and only works on the 
    //     integer part, discarding the fractional part.
    // Doing better means deciding on whether you're just representing
    // the subset of javascript numbers of twos-complement 32-bit integers 
    // or going with base-64 representations for the bit pattern of the
    // underlying IEEE floating-point number, or representing the mantissae
    // and exponents separately, or some other possibility. For now, bail
    fromNumber : function(number) {
        if (isNaN(Number(number)) || number === null ||
            number === Number.POSITIVE_INFINITY)
            throw "The input is not valid";
        if (number < 0)
            throw "Can't represent negative numbers now";

        var rixit; // like 'digit', only in some non-decimal radix 
        var residual = Math.floor(number);
        var result = '';
        while (true) {
            rixit = residual % 64
            // console.log("rixit : " + rixit);
            // console.log("result before : " + result);
            result = this._Rixits.charAt(rixit) + result;
            // console.log("result after : " + result);
            // console.log("residual before : " + residual);
            residual = Math.floor(residual / 64);
            // console.log("residual after : " + residual);

            if (residual == 0)
                break;
            }
        return result;
    },

    toNumber : function(rixits) {
        var result = 0;
        // console.log("rixits : " + rixits);
        // console.log("rixits.split('') : " + rixits.split(''));
        rixits = rixits.split('');
        for (e in rixits) {
            // console.log("_Rixits.indexOf(" + rixits[e] + ") : " + 
                // this._Rixits.indexOf(rixits[e]));
            // console.log("result before : " + result);
            result = (result * 64) + this._Rixits.indexOf(rixits[e]);
            // console.log("result after : " + result);
        }
        return result;
    },
    fromCoord: function(c) {	
	return Base64.fromNumber((Math.floor(c[0]+900)+(2000*Math.floor(c[1]+900))+(4000000*Math.floor(180+c[2]))));
    },
    toCoord: function(c) {
	var x=Base64.toNumber(c);
	var y=[x%2000-900,
	       Math.floor(x/2000)%2000-900,
	       Math.floor(x/4000000)-180];
	return y;
    }
}

function ActionQueue() {
    this.queue=[];
    this.isexecuting=false;
}
ActionQueue.prototype= {
    add: function(f) {
	/*if (!this.isexecuting&&!activeunit.incombat) {
	    this.isexecuting=true;
	    activeunit.show();
	    f.call()
	} else*/ this.queue.push(f);
    },
    next: function() {
	if (this.queue.length>0) {
	    var f;
	    f=this.queue.shift();
	    this.isexecuting=true;
	    activeunit.show();
	    f.call();
	    return true;
	} 
	this.isexecuting=false;
	return false;
    },
}
waitingforaction=new ActionQueue();

function nextstep() {
    var i;
    //console.log("nextstep:"+phase+" "+activeunit.name);
    if (activeunit.incombat) return;
    //console.log("nextstep:waitingforaction.next(begin):"+waitingforaction.queue.length);
    if (!waitingforaction.next()&&waitingforaction.queue.length==0) {
	//console.log("nextstep:"+activeunit.name);
	switch(phase) {
	case PLANNING_PHASE:
	    enablenextphase(); 
	    nextplanning();
	    break;
	case ACTIVATION_PHASE:
	    enablenextphase();
	    //console.log("nextstep:nextactivation");
	    if (subphase==DECLOAK_PHASE) nextdecloak();
	    else nextactivation();
	    break;
	case COMBAT_PHASE:
	    //console.log("nextstep:nextcombat");
	    nextcombat();
	    break;
	}
    }
}
function center() {
    var bbox=activeunit.g.getBBox();
    var xx=(bbox.x+bbox.width/2);
    var yy=(bbox.y+bbox.height/2)
    var w=$("#svgout").width();
    var h=$("#svgout").height();
    var startX=0;
    var startY=0;
    if (h>w) startY=(h-w)/2;
    else startX=(w-h)/2;
    var min=Math.min(w/900.,h/900.);
    var x=startX+VIEWPORT.m.x(xx,yy)*min;
    var y=startY+VIEWPORT.m.y(xx,yy)*min
    var mm=VIEWPORT.m.invert();
    if (x<0||x>w) VIEWPORT.m=MT((-x+w/2-startX)/min,0).add(VIEWPORT.m);
    if (y<0||y>h) VIEWPORT.m=MT(0,(-y+h/2-startY)/min).add(VIEWPORT.m);

    VIEWPORT.transform(VIEWPORT.m);
    activeunit.show();
}

function prevselect() {
    if(waitingforaction.isexecuting) { return; }
    var old=activeunit;
    if (phase==ACTIVATION_PHASE||phase==COMBAT_PHASE) {
	if (skillturn==-1) return;
	active=(active==0)?tabskill[skillturn].length-1:active-1;
	tabskill[skillturn][active].select();
    } else { 
	active=(active==0)?squadron.length-1:active-1; 
	squadron[active].select();
    }
    old.unselect() ;
}
function nextselect() {
    var old=activeunit;
    if (phase==ACTIVATION_PHASE||phase==COMBAT_PHASE) {
	if (skillturn==-1) return;
	active=(active==tabskill[skillturn].length-1)?0:active+1;
	tabskill[skillturn][active].select();
    } else {
	active=(active==squadron.length-1)?0:active+1;
	squadron[active].select();
    }
    old.unselect() ; 
}
function hitrangetostr(r) {
    var str="";
    var i,j,k,h;
    var wn=[];
    for (h=0; h<squadron.length; h++) if (squadron[h]==activeunit) break;
    for (i=1; i<=3; i++) {
	if (r[i].length>0) {
	    for (j=0; j<r[i].length; j++) {
		var k=r[i][j].unit;
		var sh=squadron[k];
		str+="<tr>";
		str+="<td class='tohit'>"+i+"</td>";
		str+="<td>"+sh.name+"</td>";		
		for (w=0; w<r[i][j].wp.length; w++) {
		    var wp=activeunit.weapons[w];
		    var p=activeunit.evaluatetohit(w,sh);
		    if (p==undefined) break;
		    var kill=p.tokill[sh.hull+sh.shield];
		    if (typeof kill=="undefined") kill=0; else 
			kill=Math.floor(kill*10000)/100;
		    // Add type to possible weapons
		    if (wn.indexOf(wp.type)==-1) wn.push(wp.type);
		    str+="<td class='probacell' style='background:hsl("+(1.2*(100-p.tohit))+",100%,80%)'";
		    if (phase==COMBAT_PHASE && skillturn==activeunit.skill&&activeunit.canfire()) str+=" onclick='activeunit.incombat=true; activeunit.declareattack("+w+",squadron["+k+"]); activeunit.resolveattack("+w+",squadron["+k+"])'>"; else str+=">";
		    str+="<div class='reddice'>"+activeunit.getattackstrength(w,sh)+"</div><div class='greendice'>"+sh.getdefensestrength(w,activeunit)+"</div>"
		    str+="<div>"+p.tohit+"%</div><div><code class='symbols' style='border:0'>d</code>"+p.meanhit+"</div><div><code class='symbols'  style='border:0'>c</code>"+p.meancritical+"</div><div>"+kill+"% kill</div>"
		    str+="</td>";
		    //
			//str+="<div><a href='#combatmodal' onclick=\"resolvecombat("+k+","+w+")\" class='bigbutton'>Fire!</a></div>";
		    //else 
		}   
		str+="</tr>";
	    }
	}
    }
    if (str=="") { str="No unit in range of "+activeunit.name; 
		   activeunit.istargeting=false; }
    else {
	var s="";
	s="<table><tr><th>Range</th><th>Name</th>";
	for (i=0; i<wn.length; i++) {
	    s+="<th style='width:2em;border:0'><div class='"+wn[i]+"' style='width:100px;border:0;background:white;color:black'></div></th>"
	}
	str=s+"</tr>"+str+"</table>"
    }
    return str;
}
function inhitrange() {
    $("#listtitle").html("Units in weapon range of "+activeunit.name);
    $("#listunits").html(hitrangetostr(activeunit.gethitrangeallunits()));
    window.location="#modal";
}

function unitstostr() {
    var s;
    var i,j;
    var sobj=["","",""];
    for (i=0; i<squadron.length; i++) {
	var sh=squadron[i];
	sobj[sh.team]+=sh;
    }
    s="<div id='squad1'><div>Stats</div><div>Names</div><div>Ship</div><div>Points</div><div>Description</div></div>"+sobj[1]
	+"<div id='squad2'><div>Stats</div><div>Names</div><div>Ship</div><div>Points</div><div>Description</div></div>"+ sobj[2];
    return s;
}
function allunitlist() {
    $("#listtitle").html("List of units");
    $("#listunits").html(unitstostr()); 
    window.location="#modal";
}

function nextcombat() {
    var i,sk=0,last=0;
    var old=activeunit;
    while (sk==0 && skillturn>=0) {
	for (i=0; i<tabskill[skillturn].length; i++) {
	    if (tabskill[skillturn][i].canfire()) { sk++; last=i; break;} 
	};
	if (sk==0) {
	    var dead=false;
	    skillturn--;
	    for (i=0; i<tabskill[skillturn+1].length; i++) {
		var u=tabskill[skillturn+1][i];
		if (u.canbedestroyed(skillturn))
		    if (u.checkdead()) dead=true;
	    }
	    if (dead&&(TEAMS[1].checkdead()||TEAMS[2].checkdead())) win();
	    // Change PS. Check deads here. 
	    while (skillturn>=0 && tabskill[skillturn].length==0) { skillturn--; }
	} 
    }
    if (skillturn==-1) { 
	log("No more firing units, ready to end phase."); 	
	// Clean up phase
	for (i=0; i<squadron.length; i++) squadron[i].endcombatphase();
	return; 
    }
    sk=tabskill[skillturn].length;
    //console.log("found "+sk+" firing units of skill "+skillturn);
    active=last; 
    tabskill[skillturn][last].select();
    old.unselect();
    //console.log("nextcombat:"+activeunit.name);
    activeunit.beginattack();
    activeunit.doattack(false);
}
function nextactivation() {
    var sk=0,last=0,i;
    if (skillturn>12) { return; }
    // Counts how many remaining units with same skill
    for (i=0; i<tabskill[skillturn].length; i++) {
	if (tabskill[skillturn][i].maneuver!=-1) { sk++; last=i; } 
    }
    if (sk==0) { 
	skillturn++;
	while (skillturn<13 && tabskill[skillturn].length==0) { skillturn++; }
	if (skillturn==13) { return; }
	sk=tabskill[skillturn].length;
	last=0;
    }
    var old=activeunit;
    active=last; 
    activeunit=tabskill[skillturn][last];
    old.unselect();    
    activeunit.select(); 
    activeunit.beginactivation(); 
    activeunit.doactivation();
}
function nextdecloak() {
    var sk=0,last=0,i;
    if (skillturn>12) { subphase=ACTIVATION_PHASE; skillturn=0; return nextstep(); }
    // Counts how many remaining units with same skill
    while (sk==0) {
	for (i=0; i<tabskill[skillturn].length; i++) {
	    if (tabskill[skillturn][i].candecloak()) { sk++; last=i; } 
	}
	if (sk==0) { 
	    skillturn++;
	    while (skillturn<13 && tabskill[skillturn].length==0) { skillturn++; }
	    if (skillturn==13) { subphase=ACTIVATION_PHASE; skillturn=0; return nextstep(); }
	    sk=tabskill[skillturn].length;
	    last=0;
	}
    }
    var old=activeunit;
    active=last; 
    activeunit=tabskill[skillturn][last];
    old.unselect();    
    activeunit.select(); 
    activeunit.dodecloak();
}
function nextplanning() {
    var current=active;
    for (var i=0; i<squadron.length; i++,active=(active+1)%squadron.length) {
	if (squadron[active].maneuver==-1) break;
    }
    if (squadron[active].maneuver>-1) active=current;
    else {
	var old=activeunit;
	activeunit=squadron[active];
	activeunit.select();
	old.unselect();
	activeunit.doplan();
    }
}
function addroll(f,n,id) {
    var i,j=0;
    var foc=$(".focusreddice").length;
    var h=$(".hitreddice").length;
    var c=$(".criticalreddice").length;
    var t=f(100*foc+10*c+h,n);
    n=t.n;
    //console.log("addroll with "+n+" rolls:"+m);
    var r=t.m; 
    $("#attack").empty();
    for (i=0; i<Math.floor(r/100)%10; i++,j++)
	$("#attack").append("<td class='focusreddice'></td>");
    for (i=0; i<(Math.floor(r/10))%10; i++,j++)
	$("#attack").append("<td class='criticalreddice'></td>");
    for (i=0; i<r%10; i++,j++)
	$("#attack").append("<td class='hitreddice'></td>");
    for (i=j; i<n; i++)
	$("#attack").append("<td class='blankreddice'></td>");
    $("#moda"+id).remove();
}
function modroll(f,n,id) {
    var i,j=0;
    var foc=$(".focusreddice").length;
    var h=$(".hitreddice").length;
    var c=$(".criticalreddice").length;
    var r=f(100*foc+10*c+h,n);
    $("#attack").empty();
    //console.log("modifying with "+(100*foc+10*c+h)+"->"+r+" value dice/"+n);
    for (i=0; i<Math.floor(r/100)%10; i++,j++)
	$("#attack").append("<td class='focusreddice'></td>");
    for (i=0; i<(Math.floor(r/10))%10; i++,j++)
	$("#attack").append("<td class='criticalreddice'></td>");
    for (i=0; i<r%10; i++,j++)
	$("#attack").append("<td class='hitreddice'></td>");
    //console.log("modifying with "+(n-j)+" blank dices");
    for (i=j; i<n; i++)
	$("#attack").append("<td class='blankreddice'></td>");
    $("#moda"+id).remove();
}
function modrolld(f,n,id) {
    var i,j=0;
    var foc=$(".focusgreendice").length;
    var e=$(".evadegreendice").length;
    //log("mod roll before "+foc+" "+e+" "+(n-foc-e));
    var r=f(10*foc+e,n);
    var a=Math.floor(r/10);
    var b=r%10;
    var c=n-a-b;
    //log("mod roll after "+a+" "+b+" "+c);
    $("#defense").empty();
    for (i=0; i<Math.floor(r/10); i++,j++)
	$("#defense").append("<td class='focusgreendice'></td>");
    for (i=0; i<r%10; i++,j++)
	$("#defense").append("<td class='evadegreendice'></td>");
    for (i=j; i<n; i++)
	$("#defense").append("<td class='blankgreendice'></td>");
    $("#modd"+id).remove();
}

function reroll(n,forattack,type,id) {
    var i;
    var l;
    var m=0;
    var attackroll=["blank","focus","hit","critical"];
    var defenseroll=["blank","focus","evade"];
    if (forattack) {
	for (i=0; i<4; i++) {
	    if (type%10>=1) {
		l=$("."+attackroll[i]+"reddice:not([noreroll])");
		if (l.length<n) {
		    l.remove();
		    m+=l.length;n-=l.length;
		} else {
		    $("."+attackroll[i]+"reddice:lt("+n+"):not([noreroll])").remove();
		    m+=n;n=0;
		}
		type=Math.floor(type/10);
	    }
	}
	//console.log("rerolling "+m+" dices");
	$("#rerolla"+id).remove();
	for (i=0; i<m; i++) {
	    var r=Math.floor(Math.random()*8);
	    $("#attack").prepend("<td noreroll='true' class='"+FACE[ATTACKDICE[r]]+"reddice'></td>");
	}
    } else { 
	for (i=0; i<3; i++) {
	    if (type%10>=1) {
		l=$("."+defenseroll[i]+"greendice:not([noreroll])");
		if (l.length<n) {
		    l.remove();
		    m+=l.length;n-=l.length;
		} else {
		    $("."+attackroll[i]+"greendice:lt("+n+"):not([noreroll])").remove();
		    m+=n;n=0;
		}
		type=Math.floor(type/10);
	    }
	}
	$("#rerolld"+id).remove();
	for (i=0; i<m; i++) {
	    var r=Math.floor(Math.random()*8);
	    $("#defense").prepend("<td noreroll='true' class='"+FACE[DEFENSEDICE[r]]+"greendice'></td>");
	}
    }
}

function enablenextphase() {
    var i;
    var ready=true;
    switch(phase) {
    case PLANNING_PHASE:
	for (i=0; i<squadron.length; i++)
	    if (squadron[i].maneuver<0&&!squadron[i].isdead) { ready=false; break; }
	if (ready&&$(".nextphase").prop("disabled")) log("All units have planned a maneuver, ready to end phase");
	break;
    case ACTIVATION_PHASE:
	for (i=0; i<squadron.length; i++)
	    if (squadron[i].maneuver>-1&&!squadron[i].isdead) { ready=false; break; }
	if (ready&&$(".nextphase").prop("disabled")) log("All units have been activated, ready to end phase");
	break;	
    }
    if (ready) $(".nextphase").prop("disabled",false);
    return ready;
}

var keybindings={
    phase0:[],
    phase1:[],
    phase2:[
	{k:'t',f:function() { activeunit.turn(45);}},
	{k:"shift+t",f:function() {activeunit.turn(-45); }},
	{k:"b",f:function() { activeunit.turn(5);}},
	{k:"shift+b",f:function() { activeunit.turn(-5,0,0);}}],
    phase3:[
	{k:"m",f: function () { activeunit.nextmaneuver(); }},
	{k:"shift+m",f:function() {activeunit.prevmaneuver(); }}
    ],
    phase4:[],
    phase5:[{k:'enter',f:function() {inhitrange(); window.location='#modal' }}],
    action:[
	{k:"a", f:function() { 
	    if (!activeunit.actiondone
		&&activeunit.hasmoved
		&&activeunit.skill==skillturn)   {
		activeunit.nextaction(); 
	    }
	}},
	{k:"shift+a", f:function() { 
	    if (!activeunit.actiondone
		&&activeunit.hasmoved
		&&activeunit.skill==skillturn)  {
		activeunit.prevaction(); 
	    }
	}},
	{k:"enter",f:function() {
	    if (phase==ACTIVATION_PHASE&&!activeunit.actiondone
		&&activeunit.hasmoved
		&&activeunit.skill==skillturn) {
		resolveaction();
	    }
	}}
    ],
    select:[
	{k:'n', f:nextselect},
	{k:'shift+n',f:prevselect}
    ]
};

function win() {
    var title="";
    var str=[]
    if (TEAMS[1].checkdead()&&!TEAMS[2].checkdead()) title="Team #2 wins !";
    if (TEAMS[2].checkdead()&&!TEAMS[1].checkdead()) title="Team #1 wins !";
    if (TEAMS[1].checkdead()&&TEAMS[2].checkdead()) title="Draw !";
    $("#listtitle").html(title);
    str[1]=""; str[2]="";
    for (i=0; i<allunits.length;i++) {
	var u=allunits[i];
	str[u.team]+="<tr><td>"+u.name+"</td><td>"+Math.floor(100*u.hitresolved/round)/100+"</td><td>"+Math.floor(100*u.criticalresolved/round)/100+"</td></tr>"
    }
    str[1]="<table><tr><th>Name</th><th>Avg. Hits/round</th><th>Avg. Crit./round</th></tr>"+str[1]+"</table>";
    str[2]="<table><tr><th>Name</th><th>Avg. Hits/round</th><th>Avg. Crit./round</th></tr>"+str[2]+"</table>";    
    $("#listunits").html(str[1]+str[2]);
    window.location="#modal";
}
document.addEventListener("win",win,false);

function bind(name,c,f) { $(document.body).bind('keydown.'+name,jwerty.event(c,f)); }
function unbind(name) { $(document.body).unbind('keydown.'+name); } 
function bindall(name) {
    var kb=keybindings[name];
    var j;
    for (j=0; j<kb.length; j++) {
	bind(name,kb[j].k,kb[j].f);
    }	    
}
var phasetext = ["Build squad #1", "Build squad #2", "Setup","Planning","Activation","Combat"];

function filltabskill() {
    tabskill=[];
    for (i=0; i<=12; i++) tabskill[i]=[];
    for (i=0; i<squadron.length; i++) tabskill[squadron[i].skill].push(squadron[i]);
}

var ZONE=[];

function nextphase() {
    var i;
    // End of phases
    //if (!enablenextphase()) return;
    window.location="#"
    switch(phase) {
    case SELECT_PHASE1:
	$("#rightpanel").show();
	ZONE[3]=s.rect(0,0,900,900).attr({
            strokeWidth: 6,
	    stroke:halftone(WHITE),
	    strokeDasharray:"20,10,5,5,5,10",
	    fillOpacity: 0,
	    id:'ZONE',
	    pointerEvents:"none"
	});
	ZONE[3].appendTo(VIEWPORT);
	ZONE[1]=s.rect(0,0,100,900).attr({
            fill: TEAMS[1].color,
            strokeWidth: 2,
	    opacity: 0.3,
	    pointerEvents:"none"
	});
	ZONE[1].appendTo(VIEWPORT);
	break;
    case SELECT_PHASE2:
	ZONE[2]=s.rect(800,0,100,900).attr({
            fill: TEAMS[2].color,
            strokeWidth: 2,
	    opacity: 0.3,
	    pointerEvents:"none"
	});
	ZONE[2].appendTo(VIEWPORT);
	break;
    case SETUP_PHASE: 
	ZONE[1].remove();
	ZONE[2].remove();
	TEAMS[1].endsetup();
	TEAMS[2].endsetup();
	$(".playerselect").remove();
	$(".nextphase").prop("disabled",true);
	$(".unit").css("cursor","pointer");
	$("#positiondial").hide();
	for (i=0; i<OBSTACLES.length; i++) OBSTACLES[i].g.undrag();
	break;
    case PLANNING_PHASE:
	$("#maneuverdial").hide();
	break;
    case ACTIVATION_PHASE:
	$("#actiondial").hide();
	$("#activationdial").hide();
	for (i=0; i<squadron.length; i++) {
	    squadron[i].hasmoved=false; squadron[i].actiondone=false;
	    squadron[i].endactivationphase();
	}
	var b=[];
	for (i=0; i<BOMBS.length; i++) b[i]=BOMBS[i];
	for (i=0; i<b.length; i++) b[i].explode();
	break;
    case COMBAT_PHASE:
	$("#attackdial").hide();
	$("#listunits").html("");
	for (i=0; i<squadron.length; i++) squadron[i].endround();
	round++;
	break;
    }
    phase=(phase==COMBAT_PHASE)?PLANNING_PHASE:phase+1;
 
    if (phase<3) $("#phase").html(phasetext[phase]);
    else $("#phase").html("Turn #"+round+" "+phasetext[phase]);
    $("#combatdial").hide();
    if (phase>SELECT_PHASE2) for (i=0; i<squadron.length; i++) {squadron[i].unselect();}
    // Init new phase
    for (i=SELECT_PHASE1; i<=COMBAT_PHASE; i++) {
	if (i!=phase) unbind("phase"+i);
	else bindall("phase"+i);
    }
    switch(phase) {
    case SELECT_PHASE1:
	$(".permalink").hide()
	$(".activeunit").prop("disabled",true);
	$("#rightpanel").hide();
	break;
    case SELECT_PHASE2:
	$("#team1").css("top",$("nav").height());
	TEAMS[1].endselection(s);
	break;
    case SETUP_PHASE:
	$("#team2").css("top",$("nav").height());
	TEAMS[2].endselection(s);
	$(".activeunit").prop("disabled",false);
	activeunit=squadron[0];
	activeunit.select();
	activeunit.show();

	$("#svgout").bind('mousewheel DOMMouseScroll', function(event){
	    var e = event.originalEvent; // old IE support
	    var w=$("#svgout").width();
	    var h=$("#svgout").height();
	    var startX=0;
	    var startY=0;
	    if (h>w) startY=(h-w)/2;
	    else startX=(w-h)/2;
	    var max=Math.max(900./w,900./h);
	    var offsetX=(e.clientX-$("#team1").width()-startX)*max;
	    var offsetY=(e.clientY-$("nav").height()-startY)*max;
	    var delta;
	    if (typeof e.wheelDelta != "undefined") 
		delta=e.wheelDelta / 360.;
	    else delta = e.detail/ -9.;
	    var z=Math.pow(1.1, delta);
	    var vm=VIEWPORT.m.clone().invert();
	    var x=vm.x(offsetX,offsetY);
	    var y=vm.y(offsetX,offsetY);

	    VIEWPORT.m.translate(x,y).scale(z).translate(-x,-y);
	    VIEWPORT.transform(VIEWPORT.m);
	    activeunit.show();
	});

	$("#svgout").mousedown(function(event) { dragstart(event);});
	$("#svgout").mousemove(function(e) {dragmove(e);});
	$("#svgout").mouseup(function(e) {dragstop(e);});

	jwerty.key('l', allunitlist);
	jwerty.key('w', inhitrange);
	jwerty.key('s', nextstep);
	jwerty.key("x", function() { window.location="#";});
	jwerty.key("escape", nextphase);
	jwerty.key("c", center);
	/* By-passes */
	jwerty.key("0", function() { console.log("active:"+activeunit.name+" pending actions:"+waitingforaction.isexecuting+" can fire:"+activeunit.canfire()+" has damaged:"+activeunit.damage+" m:"+activeunit.maneuver+" a:"+activeunit.action+" skillturn"+skillturn+" faction"+activeunit.faction); });
	jwerty.key("9", function() { 
		console.log("active:"+activeunit.name+" in hit range:"+activeunit.weapons[0].name);
		var w=activeunit.weapons[0];
		for (var i=0; i<squadron.length; i++) {
		    console.log("      "+squadron[i].name+":"+w.getrange(squadron[i]));
		}
	    });
	jwerty.key("p",function() {
	    activeunit.showpossiblepositions();
	});
	jwerty.key("shift+p",function() {
	    $(".possible").remove();
	});
	jwerty.key("1", function() { activeunit.focus++;activeunit.show();});
	jwerty.key("2", function() { activeunit.evade++;activeunit.show();});
	jwerty.key("3", function() { if (!activeunit.iscloaked) {activeunit.iscloaked=true;activeunit.agility+=2;activeunit.show();}});
	jwerty.key("4", function() { activeunit.stress++;activeunit.show();});
	jwerty.key("5", function() { activeunit.ionized++;activeunit.show();});
	jwerty.key("shift+1", function() { if (activeunit.focus>0) activeunit.focus--;activeunit.show();});
	jwerty.key("shift+2", function() { if (activeunit.evade>0) activeunit.evade--;activeunit.show();});
	jwerty.key("shift+3", function() { if (activeunit.iscloaked) {activeunit.iscloaked=false;activeunit.agility-=2;activeunit.show();}});
	jwerty.key("shift+4", function() { if (activeunit.stress>0) activeunit.stress--;activeunit.show();});
	jwerty.key("shift+5", function() { if (activeunit.ionized>0) activeunit.ionized--;activeunit.show();});
	jwerty.key("f",function() { activeunit.doattack(true);});
	jwerty.key("d",function() { activeunit.resolvecritical(1);});
	jwerty.key("shift+d",function() { 
	    if (activeunit.hull<activeunit.ship.hull) activeunit.hull++; 
	    else if (activeunit.shield<activeunit.ship.shield) activeunit.shield++; 
	    activeunit.show();
	});
	loadrock(s,ROCKDATA);
	if (OBSTACLES.length>0) showrock();
	log("<div>[turn "+round+"] Setup phase</div>");
	$(".unit").css("cursor","move");
	$("#positiondial").show();
	bindall("select");
	$(".permalink").show()
	break;
    case PLANNING_PHASE: 
	active=0;
	$(".permalink").hide();
	log("<div>[turn "+round+"] Planning phase</div>");
	$(".nextphase").prop("disabled",true);
	$("#maneuverdial").show();
	var old=activeunit;
	squadron[0].select();
	old.unselect();
	for (i=0; i<squadron.length; i++) {
	    squadron[i].evaluatepositions(false,false);
	    squadron[i].beginplanningphase();
	}
	activeunit.doplan();
	break;
    case ACTIVATION_PHASE:
	log("<div>[turn "+round+"] Activation phase</div>");
	$(".nextphase").prop("disabled",true);
	$("#activationdial").show();
	for (i=0; i<squadron.length; i++) {
	    squadron[i].beginactivationphase();
	}
	filltabskill();
	//subphase=DECLOAK_PHASE;
	skillturn=0;
	//console.log("nextphase:ACTI>nextstep");
	nextstep();
	//console.log("nextphase:ACTI<nextstep");
	break;
    case COMBAT_PHASE:
	log("<div>[turn "+round+"] Combat phase</div>");
	$("#attackdial").show();
	skillturn=12;
	for (i=0; i<squadron.length; i++) squadron[i].begincombatphase();
	//console.log("nextphase:COMBAT>nextstep");
	nextstep();
	//console.log("nextphase:COMBAT<nextstep");
	break;
    }
    if (phase>SELECT_PHASE2) activeunit.show();
}
function log(str) {
    $("#log").append("<div>"+str+"<div>");
    $("footer").scrollTop(10000);
}
function permalink() {
   var s="?"+TEAMS[1].toASCII()+"&"+TEAMS[2].toASCII()+"&"+saverock();
    document.location.search = s;
}
function resetlink() {
    document.location.search="";
}
function record(id,str) {
    //$("#log").append("<div style='color:red'>allunits["+id+"]."+str+"<div>");
    //$("footer").scrollTop(10000);
}
function select(name) {
    var i;
    for (i=0; i<squadron.length; i++) {
	if (squadron[i].id==name) break;
    }
    var u=activeunit;
    activeunit=squadron[i];
    activeunit.select();
    $("#"+u.id).attr({color:"black",background:"white"});
    $("#"+activeunit.id).attr({color:"white",background:"tomato"});
    u.unselect();
}

var a1 = [];
a1[0]=2/8; // blank
a1[1]=3/8; // hit
a1[10]=1/8; // crit
a1[100]=2/8; // focus
var d1 = [];
d1[0]=3/8; // blank
d1[1]=3/8; // evade
d1[10]=2/8; // focus

// Add one dice to already existing roll of n dices
function addattackdice(n,proba) {
    var f,c,h,i;
    var p=[];
    for (f=0; f<n; f++) 
	for (h=0; h<n-f; h++)
	    for (c=0; c<n-h-f; c++) {
		i=100*f+h+10*c;
		p[i]=0;
		p[i+1]=0;
		p[i+10]=0;
		p[i+100]=0;
	    }
    for (f=0; f<n; f++) 
	for (h=0; h<n-f; h++) 
	    for (c=0; c<n-h-f; c++) {
		i=100*f+h+10*c;
		p[i]+=proba[i]*a1[0];
		p[i+1]+=proba[i]*a1[1];
		p[i+10]+=proba[i]*a1[10];
		p[i+100]+=proba[i]*a1[100];
	    }
    return p;
}
function adddefensedice(n,proba) {
    var f,e,i;
    var p=[];
    for (f=0; f<n; f++) {
	for (e=0; e<n-f; e++) {
	    i=10*f+e;
	    p[i]=0;
	    p[i+1]=0;
	    p[i+10]=0;	   
	}
    }
    for (f=0; f<n; f++) {
	for (e=0; e<n-f; e++) {
	    i=10*f+e;
	    p[i]+=proba[i]*d1[0];
	    p[i+1]+=proba[i]*d1[1];
	    p[i+10]+=proba[i]*d1[10];
	}
    }
    return p;
}

function attackproba(n) {
    var i;
    var proba=[];
    proba[0]=a1[0];
    proba[1]=a1[1];
    proba[10]=a1[10];
    proba[100]=a1[100];
    for (i=2; i<=n; i++) {
	proba=addattackdice(i,proba);
    }

    return proba;
}
function defenseproba(n) {
    var i;
    var proba=[];
    proba[0]=d1[0];
    proba[1]=d1[1];
    proba[10]=d1[10];
    for (i=2; i<=n; i++) {
	proba=adddefensedice(i,proba);
    }
    return proba;
}
function attackwithreroll(tokensA,at,attack) {
    var f,h,c,f2,h2,c2,i,j,b;
    var p=[];
    if (tokensA.reroll==0) return at;
    if (typeof tokensA.reroll=="undefined") return at;
    //log("THERE IS REROLL:"+tokensA.reroll);
    for (f=0; f<=attack; f++) 
	for (h=0; h<=attack-f; h++)
	    for (c=0; c<=attack-h-f; c++) {
		i=100*f+h+10*c;
		p[i]=0;
	    }
    var newf=0, r;
    for (f=0; f<=attack; f++) 
	for (h=0; h<=attack-f; h++) 
	    for (c=0; c<=attack-h-f; c++) {
		i=100*f+h+10*c;
		b=attack-h-c-f; // blanks
		r=tokensA.reroll;
		newf=f;
		if (tokensA.reroll>b) { // more reroll than blanks
		    if (tokensA.focus==0) {
			if (tokensA.reroll>f+b) { // more rerolls than blanks+focus
			    r=f+b;
			    newf=0; // no more focus in results
			} else newf=f-(r-b);
		    } else r=b;
		} 
		//log(tokensA.reroll+">>["+f+" "+h+" "+c+"] f"+newf+" r"+r);
		if (r==0) p[i]+=at[i];
		else {
		    var tot=0;
		    for (f2=0; f2<=r; f2++) 
			for (h2=0; h2<=r-f2; h2++)
			    for (c2=0; c2<=r-f2-h2; c2++) {
				j=100*f2+h2+10*c2;
				k=100*(newf+f2)+h+h2+10*(c+c2);
				p[k]+=at[i]*ATTACK[r][j];
//				if (tokensA.reroll>0) log(attack+" at["+f+" "+h+" "+c+"]:"+at[i]+"*A["+r+"]["+f2+" "+h2+" "+c2+"]:"+ATTACK[r][j]);
			    }
		}
	    }
    return p;
}
function defendwithreroll(tokensD,dt,defense) {
    var f,e,f2,e2,i,j,b;
    var p=[];
    if (tokensD.reroll==0) return dt;
    if (typeof tokensD.reroll=="undefined") return dt;
    //log("THERE IS REROLL:"+tokensA.reroll);
    for (f=0; f<=defense; f++) for (e=0; e<=defense-f; e++) p[10*f+e]=0;
    var newf=0, r;
    for (f=0; f<=defense; f++) 
	for (e=0; e<=defense-f; e++) {
	    i=10*f+e;
	    b=defense-e-f; // blanks
	    r=tokensD.reroll;
	    newf=f;
	    if (tokensD.reroll>b) { // more reroll than blanks
		if (tokensD.focus==0) {
		    if (tokensD.reroll>f+b) { // more rerolls than blanks+focus
			r=f+b;
			newf=0; // no more focus in results
		    } else newf=f-(r-b);
		} else r=b;
	    } 
	    //log(tokensA.reroll+">>["+f+" "+h+" "+c+"] f"+newf+" r"+r);
	    if (r==0) p[i]+=dt[i];
	    else {
		for (f2=0; f2<=r; f2++) 
		    for (e2=0; e2<=r-f2; e2++) {
			j=10*f2+e2;
			k=10*(newf+f2)+e+e2;
			p[k]+=dt[i]*DEFENSE[r][j];
		    }
	    }
	}
    return p;
}

function tohitproba(tokensA,tokensD,at,dt,attack,defense) {
    var p=[];
    var k=[];
    var f,h,c,d,fd,e,i,j,hit,evade;
    var tot=0,mean=0,meanc=0;
    var ATable=at;
    var DTable=dt;
    var rr=tokensA.reroll;
    var dt=(defense==0)?[]:dt;
    for (h=0; h<=attack; h++) {
	for (c=0; c<=attack-h; c++) {
	    i=h+10*c;
	    p[i]=0;
	}
    }
    
    if (typeof ATable=="undefined") return {proba:[],tohit:0,meanhit:0,meancritical:0,tokill:0};
    ATable=attackwithreroll(tokensA,at,attack);
    //log("Attack "+attack+" Defense "+defense);
    if (defense>0) DTable=defendwithreroll(tokensD,dt,defense);
    for (j=0; j<=20; j++) { k[j]=0; }
    for (f=0; f<=attack; f++) {
	for (h=0; h<=attack-f; h++) {
	    for (c=0; c<=attack-h-f; c++) {
		var n=100*f+10*c+h;
		var fa,ca,ha,ff,e;
		var a=ATable[100*f+h+10*c]; // attack index
		if (typeof tokensA.modifyattackroll!="undefined")
		    n=tokensA.modifyattackroll(n,tokensD);
		fa=Math.floor(n/100);
		ca=Math.floor((n-100*fa)/10);
		ha=n-100*fa-10*ca;
		//log("n"+n+" f"+f+" c"+c+" h"+h);
		//log("fa"+fa+" ca"+ca+" ha"+ha);
		for (ff=0; ff<=defense; ff++) {
		    for (ef=0; ef<=defense-ff; ef++) {
			var fd;
			var m=10*ff+ef
			if (typeof tokensD.modifydefenseroll!="undefined") 
			    m=tokensD.modifydefenseroll(m);
			fd=Math.floor(m/10);
			evade=m-10*fd;
			if (defense==0) d=1; else d=DTable[m]
			hit=ha;
			i=0;
			if (tokensD.evade>0) { evade+=1; }
			if (tokensD.focus>0) { evade+=fd; }
			if (tokensA.focus>0) { hit+=fa; }
			if (hit>evade) { i = hit-evade; evade=0; } 
			else { evade=evade-hit; }
			if (ca>evade) { i+= 10*(ca-evade); }
			//log("i "+i+" "+a+"*"+d);
			p[i]+=a*d;
		    }
		}
	    }
	}
    }
    for (h=0; h<=attack; h++) {
	for (c=0; c<=attack-h; c++) {
	    i=h+10*c;
	    if (c+h>0) tot+=p[i];
	    //log("c"+c+" h"+h+" "+p[i]);
	    mean+=h*p[i];
	    meanc+=c*p[i];
	    // Max 3 criticals leading to 2 damages each...Proba too low anyway after that.
	    switch(c) {
	    case 0:
		for(j=1; j<=c+h; j++) k[j]+=p[i];
		break;
	    case 1:
		for(j=1; j<=c+h; j++) k[j]+=p[i]*(33-7)/33;
		for(j=2; j<=c+h+1; j++) k[j]+=p[i]*7/33;
		break;
	    default: 
		for(j=1; j<=c+h; j++) k[j]+=p[i]*(33-7)/33*(32-7)/32;
		for (j=2; j<=c+h+1; j++) k[j]+=p[i]*(7/33*(1-6/32)+(1-7/33)*7/32);
		for (j=3; j<=c+h+2; j++) k[j]+=p[i]*7/33*6/32;
	    }
	}
    }
    return {proba:p, tohit:Math.floor(tot*10000)/100, meanhit:tot==0?0:Math.floor(mean * 100/tot) / 100,
	    meancritical:tot==0?0:Math.floor(meanc/tot*100)/100,tokill:k} ;
}

function probatable(attacker,defender) {
    var i,j;
    var str="";
    for (i=0; i<=5; i++) {
	str+="<tr><td>"+i+"</td>";
	for (j=0; j<=5; j++) {
	    var k=j;
	    if (defender.adddice>0) k+=defender.adddice;
	    var th=tohitproba(attacker,defender,ATTACK[i],DEFENSE[k],i,k);
	    str+="<td class='probacell' style='background:hsl("+(1.2*(100-th.tohit))+",100%,80%)'>";
	    str+="<div>"+th.tohit+"%</div><div><code class='symbols'>d</code>"+th.meanhit+"</div><div><code class='symbols'>c</code>"+th.meancritical+"</div></td>";
	}
	str+="</tr>";
    }
    return str;
}
function fillprobatable() {
    var attacker={focus:$("#focusA").prop("checked")?1:0,
		  reroll:$("#targetA").prop("checked")?5:0};
    var defender={focus:$("#focusD").prop("checked")?1:0,
		  evade:$("#evadeD").prop("checked")?1:0,
		  adddice:$("#cloakD").prop("checked")?2:0,
		  reroll:0}
    //log("REROLL1:"+attacker.reroll);
    var ra;
    ra=parseInt($("#rerollA").val(),10);
    var rd=parseInt($("#rerollD").val(),10);
    //log("REROLL2:"+ra+"-"+$("#rerollA").val());
    if (attacker.reroll==0||(ra>0&&ra<attacker.reroll)) attacker.reroll=ra;
    if (defender.reroll==0||(rd>0&&rd<defender.reroll)) defender.reroll=rd;

    //log("REROLL "+ra);
    var str="<tr><th>Rolls</th><th>0</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr>"+probatable(attacker,defender);
    $("#probatable").html(str);
}


var dice=1;
var ATTACK=[]
var DEFENSE=[]

var TEAMS=[0,new Team(1),new Team(2)];
var VIEWPORT;

var dragmove=function(event) {
    var e = event; // old IE support
    var x=e.offsetX,y=e.offsetY;
    if (VIEWPORT.dragged) {
	var w=$("#svgout").width();
	var h=$("#svgout").height();
	var max=Math.max(900./w,900./h);
	var ddx=(e.offsetX-VIEWPORT.x0)*max;
	var ddy=(e.offsetY-VIEWPORT.y0)*max;
	VIEWPORT.dragMatrix=MT(ddx,ddy).add(VIEWPORT.m);
	VIEWPORT.dragged=true;
	$(".phasepanel").hide();
	VIEWPORT.transform(VIEWPORT.dragMatrix);
    }
}
var dragstart=function(event) { 
    var e = event; // old IE support
    VIEWPORT.dragged=true;
    if (e.originalEvent.target.id == "svgout") {
	VIEWPORT.x0=e.offsetX;
	VIEWPORT.y0=e.offsetY;
	VIEWPORT.dragged=true; 
	VIEWPORT.dragMatrix=VIEWPORT.m;
    } else VIEWPORT.dragged=false;
}
var   dragstop= function(e) { 
    if (VIEWPORT.dragged) { 
	VIEWPORT.m=VIEWPORT.dragMatrix;
	VIEWPORT.m.clone();
	VIEWPORT.transform(VIEWPORT.m);
	activeunit.show();
    }
    VIEWPORT.dragged=false;
}

$(document).ready(function() {
    s= Snap("#svgout")
    VIEWPORT = s.g().attr({id:"viewport"});
    VIEWPORT.m=new Snap.Matrix();

    P = { F0:{path:s.path("M 0 0 L 0 0"), speed: 0, key:"5"},
	  F1:{path:s.path("M 0 0 L 0 -80"), speed: 1, key:"8"},
	  F2:{path:s.path("M 0 0 L 0 -120"), speed: 2, key:"8"},
	  F3:{path:s.path("M 0 0 L 0 -160"), speed: 3, key:"8"},
	  F4:{path:s.path("M 0 0 L 0 -200"), speed: 4, key:"8"},
	  F5:{path:s.path("M 0 0 L 0 -240"), speed: 5, key: "8" },
	  // Turn right
	  TR1:{path:s.path("M0 0 C 0 -40 15 -55 55 -55"), speed: 1, key:"6"},// 35 -35
	  TR2:{path:s.path("M0 0 C 0 -50 33 -83 83 -83"), speed:2, key:"6"},// 63 -63
	  TR3:{path:s.path("M0 0 C 0 -60 45 -105 105 -105"), speed:3, key:"6"}, // 85 -85
	  // Turn left
	  TL1:{path:s.path("M0 0 C 0 -40 -15 -55 -55 -55"), speed:1, key:"4"}, // -35 -35
	  TL2:{path:s.path("M0 0 C 0 -50 -33 -83 -83 -83"), speed:2, key:"4"},// -63 -63
	  TL3:{path:s.path("M0 0 C 0 -60 -45 -105 -105 -105"), speed:3, key:"4"}, // -85 -85
	  // Bank right
	  BR1:{path:s.path("M0 0 C 0 -20 18 -72 38 -92"), speed:1, key:"9"}, // 24 -58 (+/-14.14)
	  BR2:{path:s.path("M0 0 C 0 -30 24 -96 54 -126"), speed:2, key:"9"}, // 40 -92 (+/-14.14)
	  BR3:{path:s.path("M0 0 C 0 -40 29 -120 69 -160"), speed:3, key:"9"}, // 55 -126 (+/-14.14)
	  SR3:{path:s.path("M0 0 C 0 -40 29 -120 69 -160"), speed:3, key:"3"}, // 55 -126 (+/-14.14)
	  // Bank left
	  BL1:{path:s.path("M0 0 C 0 -20 -18 -72 -38 -92"), speed:1, key:"7"}, // 24 -58 (+/-14.14)
	  BL2:{path:s.path("M0 0 C 0 -30 -24 -96 -54 -126"), speed:2, key:"7"}, // 40 -92 (+/-14.14)
	  BL3:{path:s.path("M0 0 C 0 -40 -29 -120 -69 -160"), speed:3, key:"7"}, // 55 -126 (+/-14.14)
	  SL3:{path:s.path("M0 0 C 0 -40 -29 -120 -69 -160"), speed:3, key:"1"}, // 55 -126 (+/-14.14)
	  // K turns (similar to straight line, special treatment in move function)
	  K1:{path:s.path("M 0 0 L 0 -80"), speed: 1, key:"2"},
	  K2:{path:s.path("M 0 0 L 0 -120"), speed: 2, key:"2"},
	  K3:{path:s.path("M 0 0 L 0 -160"), speed: 3, key:"2"},
	  K4:{path:s.path("M 0 0 L 0 -200"), speed: 4, key:"2"},
	  K5:{path:s.path("M 0 0 L 0 -240"), speed: 5, key: "2" }
	};
    // Load unit data 
    $.ajax({
	dataType: "json",
	url: "data/ships.json",
	mimeType: "application/json",
	success: function(result1) {
	    var process=setInterval(function() {
		ATTACK[dice]=attackproba(dice);
		DEFENSE[dice]=defenseproba(dice);
		dice++;
		if (dice==7) {
		    fillprobatable();
		    $("#showproba").prop("disabled",false);
		    clearInterval(process);}
	    },500);
	    unitlist=result1;
	    var r=0,e=0,i;
	    squadron=[];
	    s.attr({width:"100%",height:"100%",viewBox:"0 0 900 900"});
	    TEAMS[1].setfaction("REBEL");
	    TEAMS[2].setfaction("EMPIRE");
	    UPGRADES.sort(function(a,b) { if (a.name<b.name) return -1; if (a.name>b.name) return 1; return 0; });
	    PILOTS.sort(function(a,b) { return (a.points-b.points); });
	    var n=0,u=0,ut=0;
	    var str="";
	    for (i=0; i<PILOTS.length; i++) {
		if (PILOTS[i].done==true) { if (PILOTS[i].unique) u++; n++; }
		if (!PILOTS[i].done) { 
		    if (PILOTS[i].unique) str+=", ."; else str+=", ";
		    str+=PILOTS[i].name; 
		}
	    }
	    log("<b>X-Wings Squadron Benchmark console</b>");
	    log(n+"/"+PILOTS.length+" pilots with full effect");
	    log("Pilots NOT implemented"+str);
	    n=0;
	    str="";
	    for (i=0; i<UPGRADES.length; i++) {
		if (UPGRADES[i].done==true) n++;
		else str+=", "+(UPGRADES[i].unique?".":"")+UPGRADES[i].name;
	    }
	    $(".ver").html(VERSION);
	    log(n+"/"+UPGRADES.length+" upgrades implemented");
	    log("Upgrades NOT implemented"+str);
	    phase=-1;
	    $("#showproba").prop("disabled",true);
	    var args= window.location.search.substr(1).split('&');
	    nextphase();
	    if (args.length>1) {
		log("Loading permalink...");
		ROCKDATA=args[2];
		TEAMS[1].parseASCII(s,args[0]);
		TEAMS[2].parseASCII(s,args[1]);
		//if (args.length>2) 
	    }
	    var d=new Date();
	    for (i=0; i<d.getMinutes(); i++) Math.random();
	    loadsound();
	    $("#team1").bind('mousewheel DOMMouseScroll', function(event) {
		var min=$("nav").height();
		var e = event.originalEvent; // old IE support
		var delta = Math.max(-100, Math.min(100, (e.wheelDelta || -e.detail)));
		var top=parseInt($("#team1").css("top"),10)+delta;
		if (top>min) top=min;
		var w=$("#team1").height();
		if (w>50 && top<min-w+50) top=min-w+50;
		$("#team1").css("top",(top+"px"));
	    });
	    $("#team2").bind('mousewheel DOMMouseScroll', function(event){
		var min=$("nav").height();
		var e = event.originalEvent; // old IE support
		var delta = Math.max(-100, Math.min(100, (e.wheelDelta || -e.detail)));
		var top=parseInt($("#team2").css("top"),10)+delta;
		if (top>min) top=min;
		var w=$("#team2").height();
		if (w>50 && top<min-w+50) top=min-w+50;
		$("#team2").css("top",(top+"px"));
	    });
	},
	fail: function() {
	    //console.log("failing loading ajax");
	}
    });
});
//var mypath;
//mypath=P[12].path.attr({
//    id: "squiggle",
//    fill: "none",
//    strokeWidth: "20",
//    stroke: "#fff"});
//mypath.transform(ship[0].m);

