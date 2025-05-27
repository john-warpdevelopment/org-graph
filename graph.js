class OrganizationGraph {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Graph data
        this.nodes = [];
        this.edges = [];
        
        // View controls
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.isDragging = false;
        this.dragTarget = null;
        this.lastMousePos = { x: 0, y: 0 };
        this.hoveredNode = null;
        
        // Physics simulation
        this.physicsEnabled = true;
        this.animationId = null;
          // Visual settings
        this.nodeRadius = 25; // Default, used if no specific type matches
        this.employeeRadius = 12.5; // Half the default size
        this.teamRadius = 50; // Double the default size
        this.projectRadius = 22; // Custom size for projects
        this.nodeColors = {
            employee: '#64b5f6',
            team: '#81c784'
            // Project colors are stored directly on project nodes
        };
        this.edgeColors = {
            member: '#90a4ae',
            mentor: '#ffb74d'
        };

        this.showProjects = true;
        this.showMentorships = true;
        this.showTeams = true;
        
        this.setupEventListeners();
        this.startAnimation();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.camera.x) / this.camera.zoom,
            y: (e.clientY - rect.top - this.camera.y) / this.camera.zoom
        };
    }
      getNodeAt(pos) {
        return this.nodes.find(node => {
            const dx = node.x - pos.x;
            const dy = node.y - pos.y;
            let radius = this.nodeRadius; // Fallback
            if (node.type === 'employee') radius = this.employeeRadius;
            else if (node.type === 'team') radius = this.teamRadius;
            else if (node.type === 'project') radius = this.projectRadius;
            return Math.sqrt(dx * dx + dy * dy) < radius;
        });
    }
    
    onMouseDown(e) {
        const mousePos = this.getMousePos(e);
        const node = this.getNodeAt(mousePos);
        
        if (node) {
            this.dragTarget = node;
            this.isDragging = true;
            node.fixed = true;
        } else {
            this.isDragging = true;
            this.dragTarget = null;
        }
        
        this.lastMousePos = { x: e.clientX, y: e.clientY };
    }
    
    onMouseMove(e) {
        if (this.isDragging) {
            const dx = e.clientX - this.lastMousePos.x;
            const dy = e.clientY - this.lastMousePos.y;
            
            if (this.dragTarget) {
                // Move node
                this.dragTarget.x += dx / this.camera.zoom;
                this.dragTarget.y += dy / this.camera.zoom;
            } else {
                // Pan camera
                this.camera.x += dx;
                this.camera.y += dy;
            }
        } else {
            // Check for hover
            const mousePos = this.getMousePos(e);
            this.hoveredNode = this.getNodeAt(mousePos);
        }
        
        this.lastMousePos = { x: e.clientX, y: e.clientY };
    }
    
    onMouseUp(e) {
        if (this.dragTarget) {
            this.dragTarget.fixed = false;
        }
        this.isDragging = false;
        this.dragTarget = null;
    }
    
    onWheel(e) {
        e.preventDefault();
        
        const mousePos = {
            x: e.clientX,
            y: e.clientY
        };
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.2, Math.min(3, this.camera.zoom * zoomFactor));
        
        // Zoom towards mouse cursor
        const worldPos = {
            x: (mousePos.x - this.camera.x) / this.camera.zoom,
            y: (mousePos.y - this.camera.y) / this.camera.zoom
        };
        
        this.camera.zoom = newZoom;
        this.camera.x = mousePos.x - worldPos.x * this.camera.zoom;
        this.camera.y = mousePos.y - worldPos.y * this.camera.zoom;
    }
      loadData() {
        // Sample organization data
        const data = {
            departments: [
                { id: 'dept1', name: 'Bespoke', description: 'Custom development solutions' },
                { id: 'dept2', name: 'OrderEazi', description: 'Order management platform' }
            ],
            projects: [
                { id: 'proj1', name: 'Phoenix Initiative', description: 'Next-gen platform', department: 'dept1' },
                { id: 'proj2', name: 'Orion Integration', description: 'Third-party API link', department: 'dept1' },
                { id: 'proj3', name: 'Vega Analytics', description: 'Data dashboard', department: 'dept2' },
                { id: 'proj4', name: 'Sirius Mobile', description: 'Mobile app development', department: 'dept2' }
            ],
            employees: [
                { id: 'emp1', name: 'Alice Johnson', role: 'Senior Developer', team: 'team1', department: 'dept1', projects: ['proj1', 'proj2'] },
                { id: 'emp2', name: 'Bob Smith', role: 'Product Manager', team: 'team1', department: 'dept1', projects: ['proj1'] },
                { id: 'emp3', name: 'Carol Davis', role: 'Designer', team: 'team2', department: 'dept2', projects: ['proj3', 'proj4'] },
                { id: 'emp4', name: 'David Wilson', role: 'Developer', team: 'team1', department: 'dept1', mentor: 'emp1', projects: ['proj2'] },
                { id: 'emp5', name: 'Eve Brown', role: 'Developer', team: 'team2', department: 'dept2', projects: ['proj3'] },
                { id: 'emp6', name: 'Frank Miller', role: 'Team Lead', team: 'team2', department: 'dept2', mentor: 'emp5', projects: ['proj4', 'proj3'] },
                { id: 'emp7', name: 'Grace Lee', role: 'Junior Developer', team: 'team2', department: 'dept2', mentor: 'emp5', projects: ['proj4'] },
                { id: 'emp8', name: 'Henry Taylor', role: 'QA Engineer', team: 'team3', department: 'dept1', projects: ['proj1'] },
                { id: 'emp9', name: 'Ivy Chen', role: 'DevOps Engineer', team: 'team3', department: 'dept2', projects: [] },
                { id: 'emp10', name: 'Jack Anderson', role: 'Intern', team: 'team1', department: 'dept1', mentor: 'emp1', projects: ['proj2'] }
            ],
            teams: [
                { id: 'team1', name: 'Frontend Team', description: 'Responsible for user interface development', department: 'dept1' },
                { id: 'team2', name: 'Backend Team', description: 'Handles server-side development', department: 'dept2' },
                { id: 'team3', name: 'Infrastructure Team', description: 'Manages deployment and infrastructure', department: 'dept1' }
            ]
        };
        
        this.createNodesAndEdges(data);
    }
      createNodesAndEdges(data) {
        this.nodes = [];
        this.edges = [];
        this.departments = [];
        const projectColor = '#9370DB'; // Medium Purple for all projects

        // Create department containers
        data.departments.forEach((dept, index) => {
            const x = (index - 0.5) * 1005; // Reduced spacing: 1000px width + 5px gap
            const y = 0;
            this.departments.push({
                id: dept.id,
                name: dept.name,
                description: dept.description,
                x: x,
                y: y,
                width: 1000, 
                height: 800
            });
        });
        
        // Create project nodes within departments
        data.projects.forEach((project, index) => {
            const dept = this.departments.find(d => d.id === project.department);
            if (!dept) {
                console.warn(`Department not found for project ${project.id}`);
                return;
            }
            // Simple positioning for now, distribute them a bit
            const projectAngle = (index / data.projects.length) * 2 * Math.PI;
            const projectRadiusOffset = dept.width / 4; // Place them within the department

            this.nodes.push({
                id: project.id,
                label: project.name,
                type: 'project',
                description: project.description,
                department: project.department,
                color: projectColor, // Use the common project color
                x: dept.x + Math.cos(projectAngle) * projectRadiusOffset,
                y: dept.y + Math.sin(projectAngle) * projectRadiusOffset + 50, // Offset Y to avoid overlap with teams
                vx: 0,
                vy: 0,
                fixed: false
            });
        });

        // Create team nodes within departments
        data.teams.forEach((team, index) => {
            const dept = this.departments.find(d => d.id === team.department);
            const teamAngle = (index % 3) * (2 * Math.PI / 3);
            
            this.nodes.push({
                id: team.id,
                label: team.name,
                type: 'team',
                description: team.description,
                department: team.department,
                x: dept.x + Math.cos(teamAngle) * 100,
                y: dept.y + Math.sin(teamAngle) * 100,
                vx: 0,
                vy: 0,
                fixed: false
            });
        });
        
        // Create employee nodes within departments
        data.employees.forEach((employee, index) => {
            const dept = this.departments.find(d => d.id === employee.department);
            if (!dept) {
                console.warn(`Department not found for employee ${employee.id}`);
                return;
            }
            const angle = Math.random() * 2 * Math.PI;
            const radius = 50 + Math.random() * 150;
            
            this.nodes.push({
                id: employee.id,
                label: employee.name,
                type: 'employee',
                role: employee.role,
                team: employee.team,
                department: employee.department,
                mentor: employee.mentor,
                x: dept.x + Math.cos(angle) * radius,
                y: dept.y + Math.sin(angle) * radius,
                vx: 0,
                vy: 0,
                fixed: false
            });
        });
        
        // Create team membership edges
        data.employees.forEach(employee => {
            this.edges.push({
                source: employee.id,
                target: employee.team,
                type: 'member'
            });
        });
        
        // Create mentor relationship edges
        data.employees.forEach(employee => {
            if (employee.mentor) {
                this.edges.push({
                    source: employee.mentor,
                    target: employee.id,
                    type: 'mentor'
                });
            }
        });

        // Create project assignment edges
        data.employees.forEach(employee => {
            if (employee.projects && employee.projects.length > 0) {
                employee.projects.forEach(projectId => {
                    const projectNode = this.nodes.find(n => n.id === projectId && n.type === 'project');
                    const employeeNode = this.nodes.find(n => n.id === employee.id && n.type === 'employee');
                    if (projectNode && employeeNode) {
                        this.edges.push({
                            source: employee.id,
                            target: projectId,
                            type: 'assignment',
                            color: projectColor // Use the common project color for edges
                        });
                    } else {
                        if (!projectNode) console.warn(`Project node ${projectId} not found for assignment edge for employee ${employee.id}`);
                        if (!employeeNode) console.warn(`Employee node ${employee.id} not found for assignment edge to project ${projectId}`);
                    }
                });
            }
        });
        
        this.centerGraph();
    }

    getVisibleNodes() {
        return this.nodes.filter(node => {
            if (node.type === 'project' && !this.showProjects) return false;
            if (node.type === 'team' && !this.showTeams) return false;
            // If a team is hidden, also hide its members if they aren't part of another visible entity (e.g. project, mentorship)
            if (node.type === 'employee' && !this.showTeams) {
                const team = this.nodes.find(t => t.id === node.team && t.type === 'team');
                if (team && !this.showTeams) {
                    // Check if employee is involved in a visible project or mentorship
                    const involvedInVisibleProject = this.showProjects && this.edges.some(edge => 
                        edge.type === 'assignment' && 
                        (edge.source === node.id || edge.target === node.id) && 
                        this.nodes.find(n => (n.id === edge.source || n.id === edge.target) && n.type === 'project' && this.showProjects)
                    );
                    const involvedInVisibleMentorship = this.showMentorships && this.edges.some(edge => 
                        edge.type === 'mentor' && 
                        (edge.source === node.id || edge.target === node.id) && 
                        this.nodes.find(n => (n.id === edge.source || n.id === edge.target) && n.type === 'employee' && this.showMentorships) 
                    );
                    if (!involvedInVisibleProject && !involvedInVisibleMentorship) return false;
                }
            }
            return true;
        });
    }

    getVisibleEdges() {
        return this.edges.filter(edge => {
            if (edge.type === 'assignment' && !this.showProjects) return false;
            if (edge.type === 'mentor' && !this.showMentorships) return false;
            if (edge.type === 'member' && !this.showTeams) return false;

            // Ensure both source and target nodes of an edge are visible
            const sourceNode = this.nodes.find(n => n.id === edge.source);
            const targetNode = this.nodes.find(n => n.id === edge.target);

            if (sourceNode && targetNode) {
                if (sourceNode.type === 'project' && !this.showProjects) return false;
                if (targetNode.type === 'project' && !this.showProjects) return false;
                if (sourceNode.type === 'team' && !this.showTeams) return false;
                if (targetNode.type === 'team' && !this.showTeams) return false;

                // If a team is hidden, hide member edges unless the employee is otherwise visible
                if (edge.type === 'member' && !this.showTeams) {
                     const employeeNode = sourceNode.type === 'employee' ? sourceNode : targetNode;
                     const teamNode = sourceNode.type === 'team' ? sourceNode : targetNode;
                     if (teamNode && !this.showTeams) {
                         const isEmployeeVisible = this.getVisibleNodes().some(n => n.id === employeeNode.id);
                         if (!isEmployeeVisible) return false;
                     }
                }
            }

            return true;
        });
    }

      updatePhysics() {
        if (!this.physicsEnabled) return;
        
        const visibleNodes = this.getVisibleNodes();
        const visibleEdges = this.getVisibleEdges();

        const repulsionStrength = 2000;
        const attractionStrength = 0.1;
        const damping = 0.92;
        const minDistance = 50;
        
        // Reset forces
        visibleNodes.forEach(node => {
            if (!node.fixed) {
                node.fx = 0;
                node.fy = 0;
            }
        });
        
        // Node-node repulsion
        for (let i = 0; i < visibleNodes.length; i++) {
            for (let j = i + 1; j < visibleNodes.length; j++) {
                const nodeA = visibleNodes[i];
                const nodeB = visibleNodes[j];
                  const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0 && distance < 250) {
                    const force = repulsionStrength / (distance * distance);
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;
                    
                    if (!nodeA.fixed) {
                        nodeA.fx -= fx;
                        nodeA.fy -= fy;
                    }
                    if (!nodeB.fixed) {
                        nodeB.fx += fx;
                        nodeB.fy += fy;
                    }
                }
            }
        }
        
        // Edge attraction
        visibleEdges.forEach(edge => {
            const source = visibleNodes.find(n => n.id === edge.source);
            const target = visibleNodes.find(n => n.id === edge.target);
            
            if (source && target) {
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const targetDistance = edge.type === 'mentor' ? 80 :
                                   edge.type === 'assignment' ? 110 :
                                   120; // Default for member
                
                if (distance > 0) {
                    const force = (distance - targetDistance) * attractionStrength;
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;
                    
                    if (!source.fixed) {
                        source.fx += fx;
                        source.fy += fy;
                    }
                    if (!target.fixed) {
                        target.fx -= fx;
                        target.fy -= fy;
                    }
                }
            }
        });        // Apply forces and update positions
        visibleNodes.forEach(node => {
            if (!node.fixed) {
                node.vx = (node.vx + node.fx) * damping;
                node.vy = (node.vy + node.fy) * damping;
                
                // Additional velocity-based damping for faster settling
                const velocity = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
                if (velocity > 0.1) {
                    const velocityDamping = Math.max(0.8, 1 - velocity * 0.01);
                    node.vx *= velocityDamping;
                    node.vy *= velocityDamping;
                } else if (velocity < 0.01) {
                    // Stop very small movements to prevent endless drift
                    node.vx = 0;
                    node.vy = 0;
                }
                
                node.x += node.vx;
                node.y += node.vy;
                  // Constrain nodes within their department boundaries
                if (node.department && this.departments) {
                    const dept = this.departments.find(d => d.id === node.department);
                    if (dept) {
                        let nodeRadius = this.nodeRadius; // Fallback
                        if (node.type === 'employee') nodeRadius = this.employeeRadius;
                        else if (node.type === 'team') nodeRadius = this.teamRadius;
                        else if (node.type === 'project') nodeRadius = this.projectRadius;
                        
                        const margin = nodeRadius + 10;
                        const minX = dept.x - dept.width/2 + margin;
                        const maxX = dept.x + dept.width/2 - margin;
                        const minY = dept.y - dept.height/2 + margin;
                        const maxY = dept.y + dept.height/2 - margin;
                        
                        if (node.x < minX) {
                            node.x = minX;
                            node.vx = Math.abs(node.vx) * 0.5; // Bounce back with reduced velocity
                        }
                        if (node.x > maxX) {
                            node.x = maxX;
                            node.vx = -Math.abs(node.vx) * 0.5;
                        }
                        if (node.y < minY) {
                            node.y = minY;
                            node.vy = Math.abs(node.vy) * 0.5;
                        }
                        if (node.y > maxY) {
                            node.y = maxY;
                            node.vy = -Math.abs(node.vy) * 0.5;
                        }
                    }
                }
            }
        });
    }
      render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        
        const visibleNodes = this.getVisibleNodes();
        const visibleEdges = this.getVisibleEdges();

        // Draw department containers
        if (this.departments) {
            this.departments.forEach(dept => {
                // Department box
                this.ctx.strokeStyle = '#888888'; // Grey border
                // this.ctx.fillStyle = dept.color + '15'; // Removed background fill
                this.ctx.lineWidth = 2; // Standard line width
                
                const x = dept.x - dept.width/2;
                const y = dept.y - dept.height/2;
                
                // this.ctx.fillRect(x, y, dept.width, dept.height); // Removed fillRect
                this.ctx.strokeRect(x, y, dept.width, dept.height);
                
                // Department label
                this.ctx.fillStyle = '#ffffff'; // White for text
                this.ctx.font = 'bold 18px "Segoe UI"';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'top';
                this.ctx.fillText(dept.name, dept.x, y + 10);
                
                // Department description
                this.ctx.fillStyle = '#ffffff'; // White for description
                this.ctx.font = '12px "Segoe UI"';
                this.ctx.fillText(dept.description, dept.x, y + 35);
            });
        }
        
        // Draw edges
        visibleEdges.forEach(edge => {
            const source = visibleNodes.find(n => n.id === edge.source);
            const target = visibleNodes.find(n => n.id === edge.target);
            
            if (source && target) {
                this.ctx.strokeStyle = edge.type === 'assignment' ? edge.color : this.edgeColors[edge.type];
                this.ctx.lineWidth = edge.type === 'assignment' ? 2 : (edge.type === 'mentor' ? 3 : 2);
                this.ctx.globalAlpha = edge.type === 'assignment' ? 0.7 : (edge.type === 'mentor' ? 0.8 : 0.6);
                
                this.ctx.beginPath();
                this.ctx.moveTo(source.x, source.y);
                this.ctx.lineTo(target.x, target.y);
                this.ctx.stroke();
                
                // Draw arrow for mentor relationships
                if (edge.type === 'mentor') {
                    const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const length = Math.sqrt(dx * dx + dy * dy);
                    const arrowLength = 15;
                    const arrowAngle = Math.PI / 6;
                      const endX = target.x - (dx / length) * (target.type === 'employee' ? this.employeeRadius : this.teamRadius);
                    const endY = target.y - (dy / length) * (target.type === 'employee' ? this.employeeRadius : this.teamRadius);
                    
                    const angle = Math.atan2(dy, dx);
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(endX, endY);
                    this.ctx.lineTo(
                        endX - arrowLength * Math.cos(angle - arrowAngle),
                        endY - arrowLength * Math.sin(angle - arrowAngle)
                    );
                    this.ctx.moveTo(endX, endY);
                    this.ctx.lineTo(
                        endX - arrowLength * Math.cos(angle + arrowAngle),
                        endY - arrowLength * Math.sin(angle + arrowAngle)
                    );
                    this.ctx.stroke();
                }
            }
        });
        
        this.ctx.globalAlpha = 1;
          // ...existing nodes rendering code...
        visibleNodes.forEach(node => {
            const isHovered = this.hoveredNode === node;
            
            let baseRadius = this.nodeRadius; // Fallback
            if (node.type === 'employee') baseRadius = this.employeeRadius;
            else if (node.type === 'team') baseRadius = this.teamRadius;
            else if (node.type === 'project') baseRadius = this.projectRadius;
            
            const radius = baseRadius + (isHovered ? 5 : 0);
            
            // Node circle
            this.ctx.fillStyle = node.type === 'project' ? node.color : this.nodeColors[node.type];
            this.ctx.strokeStyle = isHovered ? '#ffffff' : '#333333';
            this.ctx.lineWidth = isHovered ? 3 : 2;
            
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
              // Node label - handle text wrapping for teams
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = `${isHovered ? 'bold ' : ''}12px 'Segoe UI'`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            if (node.type === 'team') {
                // Split team name into words and wrap "Team" to second line
                const words = node.label.split(' ');
                if (words.length >= 2 && words[words.length - 1].toLowerCase() === 'team') {
                    const firstLine = words.slice(0, -1).join(' ');
                    const secondLine = words[words.length - 1];
                    
                    this.ctx.fillText(firstLine, node.x, node.y - 7);
                    this.ctx.fillText(secondLine, node.x, node.y + 7);
                } else {
                    this.ctx.fillText(node.label, node.x, node.y);
                }
            } else {
                this.ctx.fillText(node.label, node.x, node.y);
            }
            
            // Show additional info on hover
            if (isHovered) {
                const info = node.type === 'employee' 
                    ? `${node.role}${node.mentor ? '\nMentor: ' + this.nodes.find(n => n.id === node.mentor)?.label : ''}`
                    : node.type === 'project' 
                    ? node.description // Projects show their description on hover
                    : node.description; // Teams also show their description
                
                if (info) {
                    const lines = info.split('\n');
                    const lineHeight = 14;
                    const padding = 8;
                    const boxWidth = Math.max(...lines.map(line => this.ctx.measureText(line).width)) + padding * 2;
                    const boxHeight = lines.length * lineHeight + padding * 2;
                    
                    // Tooltip background
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    this.ctx.fillRect(
                        node.x - boxWidth / 2,
                        node.y - radius - boxHeight - 10,
                        boxWidth,
                        boxHeight
                    );
                    
                    // Tooltip text
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.font = '11px "Segoe UI"';
                    lines.forEach((line, index) => {
                        this.ctx.fillText(
                            line,
                            node.x,
                            node.y - radius - boxHeight - 10 + padding + (index + 1) * lineHeight
                        );
                    });
                }
            }
        });
        
        this.ctx.restore();
    }
    
    animate() {
        this.updatePhysics();
        this.render();
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    startAnimation() {
        this.animate();
    }
    
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    togglePhysics() {
        this.physicsEnabled = !this.physicsEnabled;
        const btn = document.getElementById('physics-btn');
        btn.textContent = this.physicsEnabled ? 'Pause Physics' : 'Resume Physics';
    }

    toggleProjectsVisibility() {
        this.showProjects = !this.showProjects;
        const btn = document.getElementById('toggle-projects-btn');
        btn.textContent = this.showProjects ? 'Hide Projects' : 'Show Projects';
    }

    toggleMentorshipsVisibility() {
        this.showMentorships = !this.showMentorships;
        const btn = document.getElementById('toggle-mentorships-btn');
        btn.textContent = this.showMentorships ? 'Hide Mentorships' : 'Show Mentorships';
    }

    toggleTeamsVisibility() {
        this.showTeams = !this.showTeams;
        const btn = document.getElementById('toggle-teams-btn');
        btn.textContent = this.showTeams ? 'Hide Teams' : 'Show Teams';
    }
    
    resetView() {
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.centerGraph();
    }
    
    centerGraph() {
        if (this.nodes.length === 0) return;
        
        const visibleNodes = this.getVisibleNodes();
        if (visibleNodes.length === 0) {
             // If no nodes are visible, reset camera to default position or a sensible overview
            this.camera.x = this.canvas.width / 2;
            this.camera.y = this.canvas.height / 2;
            this.camera.zoom = 1; // Or a zoom level that shows department outlines
            return;
        }

        // Calculate bounds of visible nodes
        let minX = visibleNodes[0].x, maxX = visibleNodes[0].x;
        let minY = visibleNodes[0].y, maxY = visibleNodes[0].y;
        
        visibleNodes.forEach(node => {
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x);
            minY = Math.min(minY, node.y);
            maxY = Math.max(maxY, node.y);
        });
        
        // Center the graph
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        this.camera.x = this.canvas.width / 2 - centerX * this.camera.zoom;
        this.camera.y = this.canvas.height / 2 - centerY * this.camera.zoom;
    }
}
