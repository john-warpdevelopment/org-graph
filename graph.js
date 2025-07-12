class OrganizationGraph {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");

    // Set canvas size
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    // Graph data
    this.nodes = [];
    this.edges = [];
    // View controls
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.isDragging = false;
    this.dragTarget = null;
    this.lastMousePos = { x: 0, y: 0 };
    this.hoveredNode = null;
    this.mouseDownPos = { x: 0, y: 0 }; // Track initial mouse position for click detection
    this.dragThreshold = 5; // Pixels moved before considering it a drag

    // Physics simulation
    this.physicsEnabled = false; // Start with physics paused
    this.animationId = null; // Visual settings
    this.nodeRadius = 25; // Default, used if no specific type matches
    this.employeeRadius = 12.5; // Half the default size
    this.projectRadius = 22; // Custom size for projects
    // Team radius is dynamic based on number of employees
    this.nodeColors = {
      employee: "#64b5f6",
      teamOwner: "#1976d2", // Darker blue for team owners
      team: "#81c784",
      project: "#9370DB",
    };
    this.edgeColors = {
      member: "#81c784",
      assignment: "#9370DB",
    };    this.showProjects = true;
    this.showTeams = true;
    this.departmentFilter = "all"; // "all" or department ID
    // Search functionality
    this.highlightedNode = null;
    this.searchResults = []; // Selection functionality
    this.selectedNode = null;
    this.highlightedEdges = new Set(); // Set of edge indices to highlight

    // Mouse tracking for click vs drag detection
    this.mouseDownPos = null;
    this.dragThreshold = 5; // pixels
    this.lastMousePos = null;

    // External URL configuration for opening nodes in new tabs
    this.baseUrls = {
      employee: "https://your-hr-system.com/employee/",
      team: "https://your-team-system.com/team/",
      project: "https://your-project-system.com/project/",
    };

    this.setupEventListeners();
    this.initializeUI();
    this.startAnimation();
  }

  initializeUI() {
    // Set initial button states based on current settings
    const physicsBtn = document.getElementById("physics-btn");
    if (physicsBtn) {
      physicsBtn.textContent = this.physicsEnabled ? "Pause Physics" : "Resume Physics";
    }
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
    this.canvas.addEventListener("wheel", (e) => this.onWheel(e));

    // Prevent context menu
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - this.camera.x) / this.camera.zoom,
      y: (e.clientY - rect.top - this.camera.y) / this.camera.zoom,
    };
  }
  getNodeAt(pos) {
    return this.nodes.find((node) => {
      const dx = node.x - pos.x;
      const dy = node.y - pos.y;
      const radius = this.getNodeRadius(node);
      return Math.sqrt(dx * dx + dy * dy) < radius;
    });
  }
  // Helper method to get the radius for any node
  getNodeRadius(node) {
    if (node.type === "employee") {
      // Double the radius for team owners
      return node.isTeamOwner ? this.employeeRadius * 2 : this.employeeRadius;
    } else if (node.type === "team") return node.radius;
    else if (node.type === "project") return this.projectRadius;
    return this.nodeRadius; // Default fallback
  }
  onMouseDown(e) {
    const mousePos = this.getMousePos(e);
    const node = this.getNodeAt(mousePos);

    this.mouseDownPos = { x: e.clientX, y: e.clientY };

    if (node) {
      this.dragTarget = node;
      this.isDragging = false; // Don't set to true immediately, wait for movement
      node.fixed = true;
    } else {
      this.isDragging = false;
      this.dragTarget = null;
    }

    this.lastMousePos = { x: e.clientX, y: e.clientY };
  }
  onMouseMove(e) {
    if (!this.lastMousePos) {
      e.preventDefault();
      return;
    }
    const dx = e.clientX - this.lastMousePos.x;
    const dy = e.clientY - this.lastMousePos.y;

    // Check if we've moved enough to start dragging
    if (!this.isDragging && this.mouseDownPos) {
      const totalMovement = Math.sqrt(
        Math.pow(e.clientX - this.mouseDownPos.x, 2) +
          Math.pow(e.clientY - this.mouseDownPos.y, 2)
      );
      if (totalMovement > this.dragThreshold) {
        this.isDragging = true;
      }
    }

    if (this.isDragging) {
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
    // Check if this was a click (not a drag)
    if (!this.isDragging && this.dragTarget) {
      // Clicked on a node
      this.selectNode(this.dragTarget);
    } else if (!this.isDragging && !this.dragTarget) {
      // Clicked on empty space (not dragged)
      this.selectNode(null);
    }
    // If it was a drag (this.isDragging === true), don't change selection

    if (this.dragTarget) {
      this.dragTarget.fixed = false;
    }

    // Reset all mouse tracking state
    this.isDragging = false;
    this.dragTarget = null;
    this.mouseDownPos = null;
  }

  onWheel(e) {
    e.preventDefault();

    const mousePos = {
      x: e.clientX,
      y: e.clientY,
    };

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(3, this.camera.zoom * zoomFactor));

    // Zoom towards mouse cursor
    const worldPos = {
      x: (mousePos.x - this.camera.x) / this.camera.zoom,
      y: (mousePos.y - this.camera.y) / this.camera.zoom,
    };

    this.camera.zoom = newZoom;
    this.camera.x = mousePos.x - worldPos.x * this.camera.zoom;
    this.camera.y = mousePos.y - worldPos.y * this.camera.zoom;
  }
  loadData(data) {
    this.data = data; // Store reference to data for tooltip access
    this.createNodesAndEdges(data);
  }
  createNodesAndEdges(data) {
    this.nodes = [];
    this.edges = [];
    this.departments = [];
    const verticalSpacing = 10;
    const containerHeight = 800;
    const containerWidth = 1000;

    // Calculate team sizes (number of employees per team)
    const teamSizes = {};
    data.employees.forEach((employee) => {
      if (employee.team) {
        teamSizes[employee.team] = (teamSizes[employee.team] || 0) + 1;
      }
    });

    // Create a map of team owners for easy lookup
    const teamOwners = new Set();
    data.teams.forEach((team) => {
      if (team.owner) {
        teamOwners.add(team.owner);
      }
    });

    //Create department containers
    data.departments.forEach((dept, index) => {
      const column = index % 2; // 0 for left, 1 for right
      const row = Math.floor(index / 2); // 0 for first row, 1 for second row, etc.
      const x = (column - 0.5) * (containerWidth + 10); // Position: left at -502.5, right at 502.5
      const y = row * (verticalSpacing + containerHeight); // Vertical spacing: 850px between rows
      this.departments.push({
        id: dept.id,
        name: dept.name,
        description: dept.description,
        x: x,
        y: y,
        width: containerWidth,
        height: containerHeight,
      });
    });

    // Create project nodes with better spacing to avoid overlaps
    const projectsByDept = {};
    data.projects.forEach((project) => {
      if (!projectsByDept[project.department]) {
        projectsByDept[project.department] = [];
      }
      projectsByDept[project.department].push(project);
    });

    // Position projects within each department with proper spacing
    Object.keys(projectsByDept).forEach((deptId) => {
      const dept = this.departments.find((d) => d.id === deptId);
      if (!dept) {
        console.warn(`Department not found for projects in ${deptId}`);
        return;
      }

      const projects = projectsByDept[deptId];
      projects.forEach((project, index) => {
        // Create a grid-like positioning for projects to avoid overlaps
        const projectsPerRow = Math.ceil(Math.sqrt(projects.length));
        const row = Math.floor(index / projectsPerRow);
        const col = index % projectsPerRow;
        
        // Add some randomness to avoid perfect grid alignment
        const baseSpacing = 150;
        const randomOffset = () => (Math.random() - 0.5) * 40;
        
        const x = dept.x + (col - (projectsPerRow - 1) / 2) * baseSpacing + randomOffset();
        const y = dept.y + (row - (Math.ceil(projects.length / projectsPerRow) - 1) / 2) * baseSpacing + 100 + randomOffset();

        this.nodes.push({
          id: project.id,
          label: project.name,
          type: "project",
          description: project.description,
          department: project.department,
          x: x,
          y: y,
          vx: 0,
          vy: 0,
          fixed: false,
        });
      });
    });
    // Create team nodes with better spacing to avoid overlaps
    const teamsByDept = {};
    data.teams.forEach((team) => {
      if (!teamsByDept[team.department]) {
        teamsByDept[team.department] = [];
      }
      teamsByDept[team.department].push(team);
    });

    // Position teams within each department around the edges
    Object.keys(teamsByDept).forEach((deptId) => {
      const dept = this.departments.find((d) => d.id === deptId);
      if (!dept) {
        console.warn(`Department not found for teams in ${deptId}`);
        return;
      }

      const teams = teamsByDept[deptId];
      teams.forEach((team, index) => {
        const radiusPerEmployee = 6;
        const minTeamRadius = 25;
        const employeeCount = teamSizes[team.id] || 0;
        const teamRadius = Math.max(
          minTeamRadius,
          employeeCount * radiusPerEmployee
        );

        // Position teams around the perimeter of the department
        const perimeter = teams.length;
        const angle = (index / perimeter) * 2 * Math.PI;
        const edgeDistance = 500; // Distance from department center to edge
        
        const x = dept.x + Math.cos(angle) * edgeDistance;
        const y = dept.y + Math.sin(angle) * edgeDistance;

        // Add small random offset to prevent perfect alignment
        const randomOffset = () => (Math.random() - 0.5) * 20;

        this.nodes.push({
          id: team.id,
          label: team.name,
          type: "team",
          description: team.description,
          department: team.department,
          radius: teamRadius,
          employeeCount: employeeCount,
          x: x + randomOffset(),
          y: y + randomOffset(),
          vx: 0,
          vy: 0,
          fixed: false,
        });
      });
    });    // Create employee nodes positioned near their teams
    data.employees.forEach((employee, index) => {
      const dept = this.departments.find((d) => d.id === employee.department);
      if (!dept) {
        console.warn(`Department not found for employee ${employee.id}`);
        return;
      }

      let x, y;
      
      if (employee.team) {
        // Find the team node to position employee near it
        const teamNode = this.nodes.find((n) => n.id === employee.team && n.type === "team");
        if (teamNode) {
          // Position employee in a circle around their team
          const angle = Math.random() * 2 * Math.PI;
          const distanceFromTeam = 60 + Math.random() * 40; // 60-100px from team
          
          x = teamNode.x + Math.cos(angle) * distanceFromTeam;
          y = teamNode.y + Math.sin(angle) * distanceFromTeam;
        } else {
          // Fallback: random position in department if team not found
          const angle = Math.random() * 2 * Math.PI;
          const radius = 50 + Math.random() * 150;
          x = dept.x + Math.cos(angle) * radius;
          y = dept.y + Math.sin(angle) * radius;
        }
      } else {
        // Employee has no team: position randomly in department center area
        const angle = Math.random() * 2 * Math.PI;
        const radius = 30 + Math.random() * 100; // Closer to center
        x = dept.x + Math.cos(angle) * radius;
        y = dept.y + Math.sin(angle) * radius;
      }

      this.nodes.push({
        id: employee.id,
        label: employee.name,
        type: "employee",
        role: employee.role,
        team: employee.team,
        department: employee.department,
        isTeamOwner: teamOwners.has(employee.id), // Mark team owners
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        fixed: false,
      });
    });

    // Create team membership edges - only connect employees to teams
    data.employees.forEach((employee) => {
      if (employee.team) {
        // Verify that the source is actually an employee node
        const sourceEmployee = this.nodes.find(
          (n) => n.id === employee.id && n.type === "employee"
        );
        // Verify that the target is actually a team node, not another entity type
        const targetTeam = this.nodes.find(
          (n) => n.id === employee.team && n.type === "team"
        );
        
        if (sourceEmployee && targetTeam) {
          this.edges.push({
            source: employee.id,
            target: employee.team,
            type: "member",
          });
        } else {
          if (!sourceEmployee) {
            console.warn(`Source employee ${employee.id} not found as employee node for team membership`);
          }
          if (!targetTeam) {
            console.warn(`Employee ${employee.id} (${employee.name}) references team ${employee.team} which doesn't exist as a team node`);
          }
        }
      }
    });

    // Create project assignment edges - only connect employees to projects
    data.employees.forEach((employee) => {
      if (employee.projects && employee.projects.length > 0) {
        employee.projects.forEach((projectId) => {
          // Verify that the target is actually a project node, not another entity type
          const projectNode = this.nodes.find(
            (n) => n.id === projectId && n.type === "project"
          );
          // Verify that the source is actually an employee node
          const employeeNode = this.nodes.find(
            (n) => n.id === employee.id && n.type === "employee"
          );
          
          if (projectNode && employeeNode) {
            this.edges.push({
              source: employee.id,
              target: projectId,
              type: "assignment",
            });
          } else {
            if (!projectNode) {
              console.warn(`Project node ${projectId} not found for assignment edge for employee ${employee.id}`);
            }
            if (!employeeNode) {
              console.warn(`Employee node ${employee.id} not found for assignment edge to project ${projectId}`);
            }
          }
        });
      }
    });

    this.centerGraph();
  }
  getVisibleNodes() {
    return this.nodes.filter((node) => {
      // Department filter
      if (this.departmentFilter !== "all" && node.department !== this.departmentFilter) {
        return false;
      }
      
      if (node.type === "project" && !this.showProjects) return false;
      if (node.type === "team" && !this.showTeams) return false;
      // If a team is hidden, also hide its members if they aren't part of another visible entity (e.g. project)
      if (node.type === "employee" && !this.showTeams) {
        const team = this.nodes.find(
          (t) => t.id === node.team && t.type === "team"
        );
        if (team && !this.showTeams) {
          // Check if employee is involved in a visible project
          const involvedInVisibleProject =
            this.showProjects &&
            this.edges.some(
              (edge) =>
                edge.type === "assignment" &&
                (edge.source === node.id || edge.target === node.id) &&
                this.nodes.find(
                  (n) =>
                    (n.id === edge.source || n.id === edge.target) &&
                    n.type === "project" &&
                    this.showProjects
                )
            );
          if (!involvedInVisibleProject) return false;
        }
      }
      return true;
    });
  }

  getVisibleEdges() {
    const visibleNodes = this.getVisibleNodes();
    
    return this.edges.filter((edge) => {
      if (edge.type === "assignment" && !this.showProjects) return false;
      if (edge.type === "member" && !this.showTeams) return false;

      // Ensure both source and target nodes are in the visible nodes list
      const sourceNode = visibleNodes.find((n) => n.id === edge.source);
      const targetNode = visibleNodes.find((n) => n.id === edge.target);

      // Only show edges where both nodes are visible
      return sourceNode && targetNode;
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
    visibleNodes.forEach((node) => {
      if (!node.fixed) {
        node.fx = 0;
        node.fy = 0;
      }
    });

    // Node-node repulsion with better collision handling
    for (let i = 0; i < visibleNodes.length; i++) {
      for (let j = i + 1; j < visibleNodes.length; j++) {
        const nodeA = visibleNodes[i];
        const nodeB = visibleNodes[j];
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        // Handle overlapping nodes by adding a minimum distance
        const minSeparation = (this.getNodeRadius(nodeA) + this.getNodeRadius(nodeB)) * 1.5;
        if (distance < minSeparation) {
          // Check if either node is a project
          const isProjectCollision = nodeA.type === "project" || nodeB.type === "project";
          
          if (isProjectCollision) {
            // For project collisions: just separate them without applying force
            if (distance < 1) {
              // If nodes are at exactly the same position, add small random offset
              distance = 1;
              const randomAngle = Math.random() * 2 * Math.PI;
              nodeB.x = nodeA.x + Math.cos(randomAngle) * minSeparation;
              nodeB.y = nodeA.y + Math.sin(randomAngle) * minSeparation;
            } else {
              // Gently separate overlapping nodes without force
              const separationDistance = minSeparation - distance;
              const moveDistance = separationDistance / 2; // Split the movement between both nodes
              
              const moveX = (dx / distance) * moveDistance;
              const moveY = (dy / distance) * moveDistance;
              
              if (!nodeA.fixed) {
                nodeA.x -= moveX;
                nodeA.y -= moveY;
              }
              if (!nodeB.fixed) {
                nodeB.x += moveX;
                nodeB.y += moveY;
              }
            }
          } else {
            // Normal collision handling for non-project nodes
            if (distance < 1) {
              // If nodes are at exactly the same position, add small random offset
              distance = 1;
              const randomAngle = Math.random() * 2 * Math.PI;
              nodeB.x = nodeA.x + Math.cos(randomAngle) * minSeparation;
              nodeB.y = nodeA.y + Math.sin(randomAngle) * minSeparation;
            }
            
            const force = repulsionStrength * 2; // Stronger force for overlapping nodes
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
        } else if (distance < 250) {
          // Check if either node is a project - projects only repel at collision distance
          const hasProject = nodeA.type === "project" || nodeB.type === "project";
          
          if (!hasProject) {
            // Normal repulsion for non-project nodes
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
          // Projects only repel at collision distance (handled above in minSeparation check)
        }
      }
    }

    // Edge attraction
    visibleEdges.forEach((edge) => {
      let source, target;
      
      if (edge.type === "member") {
        // Member edges: employee -> team
        source = visibleNodes.find((n) => n.id === edge.source && n.type === "employee");
        target = visibleNodes.find((n) => n.id === edge.target && n.type === "team");
      } else if (edge.type === "assignment") {
        // Assignment edges: employee -> project
        source = visibleNodes.find((n) => n.id === edge.source && n.type === "employee");
        target = visibleNodes.find((n) => n.id === edge.target && n.type === "project");
      } else {
        // Fallback for any other edge types
        source = visibleNodes.find((n) => n.id === edge.source);
        target = visibleNodes.find((n) => n.id === edge.target);
      }

      if (source && target) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Set target distance based on edge type - no minimum distance for projects
        const targetDistance = edge.type === "assignment" ? 0 : 240;

        // Different attraction strengths based on edge type
        let edgeAttractionStrength = attractionStrength;
        if (edge.type === "assignment") {
          // Projects have full attraction strength
          edgeAttractionStrength = attractionStrength;
        } else if (edge.type === "member") {
          // Teams have half the attraction strength of projects
          edgeAttractionStrength = attractionStrength * 0.5;
        }

        if (distance > 0) {
          const force = (distance - targetDistance) * edgeAttractionStrength;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          if (edge.type === "assignment") {
            // For project assignments: employees don't pull toward projects, but projects gravitate slightly toward employees
            if (!target.fixed) {
              // Project gravitates toward employee (but with reduced force)
              target.fx -= fx * 0.3; // Much weaker pull from project side
              target.fy -= fy * 0.3;
            }
            // Employees don't get pulled toward projects at all
          } else if (edge.type === "member") {
            // For team membership: maintain bidirectional attraction
            if (!source.fixed) {
              source.fx += fx;
              source.fy += fy;
            }
            if (!target.fixed) {
              target.fx -= fx;
              target.fy -= fy;
            }
          } else {
            // Fallback: bidirectional
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
      }
    });    // Apply forces and update positions
    visibleNodes.forEach((node) => {
      if (!node.fixed) {
        node.vx = (node.vx + node.fx) * damping;
        node.vy = (node.vy + node.fy) * damping;

        // Limit maximum velocity to prevent nodes from "shooting away"
        const maxVelocity = 10;
        const velocity = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (velocity > maxVelocity) {
          const scale = maxVelocity / velocity;
          node.vx *= scale;
          node.vy *= scale;
        }

        // Additional velocity-based damping for faster settling
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

    // Draw edges
    visibleEdges.forEach((edge, visibleIndex) => {
      let source, target;
      
      if (edge.type === "member") {
        // Member edges: employee -> team
        source = visibleNodes.find((n) => n.id === edge.source && n.type === "employee");
        target = visibleNodes.find((n) => n.id === edge.target && n.type === "team");
      } else if (edge.type === "assignment") {
        // Assignment edges: employee -> project
        source = visibleNodes.find((n) => n.id === edge.source && n.type === "employee");
        target = visibleNodes.find((n) => n.id === edge.target && n.type === "project");
      } else {
        // Fallback for any other edge types
        source = visibleNodes.find((n) => n.id === edge.source);
        target = visibleNodes.find((n) => n.id === edge.target);
      }

      if (source && target) {
        // Find the original edge index in the full edges array
        const originalEdgeIndex = this.edges.findIndex(e => 
          e.source === edge.source && 
          e.target === edge.target && 
          e.type === edge.type
        );
        
        // Check if this edge should be highlighted
        const isHighlighted = this.highlightedEdges.has(originalEdgeIndex);
        
        if (isHighlighted) {
          // Highlighted edge styling - 50% transparent gold
          this.ctx.strokeStyle = "rgba(255, 215, 0, 0.5)"; // Gold with 50% opacity
          this.ctx.lineWidth = 4;
          this.ctx.globalAlpha = 1;
        } else {
          // Normal edge styling
          this.ctx.strokeStyle = this.edgeColors[edge.type];
          this.ctx.lineWidth = 2;
          this.ctx.globalAlpha = edge.type === "assignment" ? 0.7 : 0.6;
        }

        this.ctx.beginPath();
        this.ctx.moveTo(source.x, source.y);
        this.ctx.lineTo(target.x, target.y);
        this.ctx.stroke();
      }
    });
    visibleNodes.forEach((node) => {
      this.ctx.globalAlpha = 1;

      const isHovered = this.hoveredNode === node;
      const isHighlighted = this.highlightedNode === node;
      const isSelected = this.selectedNode === node;

      const baseRadius = this.getNodeRadius(node);

      const radius =
        baseRadius +
        (isHovered ? 5 : 0) +
        (isHighlighted ? 8 : 0) +
        (isSelected ? 6 : 0); // Node circle - determine color based on node type and team owner status
      if (node.type === "employee" && node.isTeamOwner) {
        this.ctx.fillStyle = this.nodeColors.teamOwner;
      } else {
        this.ctx.fillStyle = this.nodeColors[node.type];
      }

      // Special highlighting for search results
      if (isHighlighted) {
        this.ctx.strokeStyle = "rgba(255, 255, 0, 0.5)"; // Half transparent yellow highlight
        this.ctx.lineWidth = 4;
        // Add a pulsing effect
        const pulseRadius = radius + Math.sin(Date.now() * 0.01) * 3;
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, pulseRadius, 0, 2 * Math.PI);
        this.ctx.stroke();
      } else if (isSelected) {
        // Blue selection indicator
        this.ctx.strokeStyle = "rgba(150, 150, 255, 0.2)";
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI);
        this.ctx.stroke();
      } else {
        this.ctx.strokeStyle = isHovered ? "#ffffff" : "#333333";
        this.ctx.lineWidth = isHovered ? 3 : 2;
      }

      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      this.ctx.fill();
      this.ctx.stroke();
      // Node label - handle text wrapping for teams
      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = `${isHovered ? "bold " : ""}12px 'Segoe UI'`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";

      if (node.type === "team") {
        // Split team name into words and wrap "Team" to second line
        const words = node.label.split(" ");
        if (
          words.length >= 2 &&
          words[words.length - 1].toLowerCase() === "team"
        ) {
          const firstLine = words.slice(0, -1).join(" ");
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
        let info;
        if (node.type === "employee") {
          info = node.role;
          if (node.isTeamOwner) {
            info += " (Team Owner)";
          }
          // Add department information
          if (node.department && this.data && this.data.departments) {
            const deptData = this.data.departments.find(d => d.id === node.department);
            if (deptData) {
              info += `\nDepartment: ${deptData.name}`;
            }
          }        } else if (node.type === "project") {
          info = node.description;
          // Add department information
          if (node.department && this.data && this.data.departments) {
            const deptData = this.data.departments.find(d => d.id === node.department);
            if (deptData) {
              info += `\nDepartment: ${deptData.name}`;
            }
          }
        } else if (node.type === "team") {
          // Show team description, employee count, and owner
          const employeeCount = node.employeeCount || 0;
          let ownerInfo = "";
          if (this.data && this.data.teams) {
            const teamData = this.data.teams.find((t) => t.id === node.id);
            if (teamData && teamData.owner && this.data.employees) {
              const ownerEmployee = this.data.employees.find(
                (emp) => emp.id === teamData.owner
              );
              if (ownerEmployee) {
                ownerInfo = `\nOwner: ${ownerEmployee.name}`;
              }
            }
          }
          info = `${node.description}\n${employeeCount} employee${
            employeeCount !== 1 ? "s" : ""
          }${ownerInfo}`;
          // Add department information
          if (node.department && this.data && this.data.departments) {
            const deptData = this.data.departments.find(d => d.id === node.department);
            if (deptData) {
              info += `\nDepartment: ${deptData.name}`;
            }
          }
        } else {
          info = node.description;
        }

        if (info) {
          const lines = info.split("\n");
          const lineHeight = 14;
          const padding = 8;
          const boxWidth =
            Math.max(...lines.map((line) => this.ctx.measureText(line).width)) +
            padding * 2;
          const boxHeight = lines.length * lineHeight + padding * 2;
          // Tooltip background
          this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
          this.ctx.fillRect(
            node.x - boxWidth / 2,
            node.y - radius - boxHeight - 5,
            boxWidth,
            boxHeight
          );
          // Tooltip text
          this.ctx.fillStyle = "#ffffff";
          this.ctx.font = '11px "Segoe UI"';
          lines.forEach((line, index) => {
            this.ctx.fillText(
              line,
              node.x,
              node.y -
                radius -
                boxHeight -
                10 +
                padding +
                (index + 1) * lineHeight
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
    const btn = document.getElementById("physics-btn");
    btn.textContent = this.physicsEnabled ? "Pause Physics" : "Resume Physics";
  }

  toggleProjectsVisibility() {
    this.showProjects = !this.showProjects;
    const btn = document.getElementById("toggle-projects-btn");
    btn.textContent = this.showProjects ? "Hide Projects" : "Show Projects";
  }
  toggleTeamsVisibility() {
    this.showTeams = !this.showTeams;
    const btn = document.getElementById("toggle-teams-btn");
    btn.textContent = this.showTeams ? "Hide Teams" : "Show Teams";
  }

  setDepartmentFilter(departmentId) {
    this.departmentFilter = departmentId;
    // Re-center the graph when department filter changes
    this.centerGraph();
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
    let minX = visibleNodes[0].x,
      maxX = visibleNodes[0].x;
    let minY = visibleNodes[0].y,
      maxY = visibleNodes[0].y;

    visibleNodes.forEach((node) => {
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

  // Search functionality
  searchNodes(query) {
    if (!query || query.trim() === "") {
      this.searchResults = [];
      this.highlightedNode = null;
      return [];
    }

    const searchTerm = query.toLowerCase().trim();
    this.searchResults = this.nodes.filter((node) => {
      const label = node.label.toLowerCase();
      const type = node.type.toLowerCase();
      const role = node.role ? node.role.toLowerCase() : "";
      const description = node.description
        ? node.description.toLowerCase()
        : "";

      return (
        label.includes(searchTerm) ||
        type.includes(searchTerm) ||
        role.includes(searchTerm) ||
        description.includes(searchTerm)
      );
    });

    return this.searchResults;
  }
  highlightNode(node) {
    this.highlightedNode = node;
    this.selectNode(node); // Also select the node so edit button appears
    this.focusOnNode(node);
  }

  focusOnNode(node) {
    if (!node) return;

    // Calculate the position to center the node on screen
    const targetX = this.canvas.width / 2 - node.x * this.camera.zoom;
    const targetY = this.canvas.height / 2 - node.y * this.camera.zoom;

    // Smoothly animate to the target position
    const animateToTarget = () => {
      const speed = 0.1;
      const dx = targetX - this.camera.x;
      const dy = targetY - this.camera.y;

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        this.camera.x = targetX;
        this.camera.y = targetY;
        return;
      }

      this.camera.x += dx * speed;
      this.camera.y += dy * speed;

      requestAnimationFrame(animateToTarget);
    };

    animateToTarget();
  }

  clearSearch() {
    this.highlightedNode = null;
    this.searchResults = [];
    this.highlightedEdges.clear();
  }

  // Selection functionality
  selectNode(node) {
    this.selectedNode = node;
    
    // Clear previous edge highlights
    this.highlightedEdges.clear();
    
    // Highlight edges connected to the selected node
    if (node) {
      const connectedEdgeIndices = this.getConnectedEdges(node);
      connectedEdgeIndices.forEach(index => this.highlightedEdges.add(index));
    }
    
    this.updateEditButton();
  }

  updateEditButton() {
    const editBtn = document.getElementById("edit-selected-btn");
    if (this.selectedNode) {
      editBtn.style.display = "block";
      editBtn.textContent = `Edit ${this.selectedNode.type}: ${this.selectedNode.label}`;
    } else {
      editBtn.style.display = "none";
    }
  }

  openSelectedNode() {
    if (!this.selectedNode) return;

    const baseUrl = this.baseUrls[this.selectedNode.type];
    if (baseUrl) {
      const url = `${baseUrl}${this.selectedNode.id}`;
      window.open(url, "_blank");
    } else {
      console.warn(
        `No base URL configured for node type: ${this.selectedNode.type}`
      );
    }
  }

  // Method to update base URLs from external configuration
  setBaseUrls(urls) {
    this.baseUrls = { ...this.baseUrls, ...urls };
  }

  // Get all edges connected to a specific node
  getConnectedEdges(node) {
    if (!node) return [];
    
    const connectedEdges = [];
    this.edges.forEach((edge, index) => {
      // Check if the node is the source of the edge
      const isSource = (edge.source === node.id);
      // Check if the node is the target of the edge  
      const isTarget = (edge.target === node.id);
      
      // For member edges: employee -> team
      if (edge.type === "member") {
        if (isSource && node.type === "employee") {
          connectedEdges.push(index);
        } else if (isTarget && node.type === "team") {
          connectedEdges.push(index);
        }
      }
      // For assignment edges: employee -> project
      else if (edge.type === "assignment") {
        if (isSource && node.type === "employee") {
          connectedEdges.push(index);
        } else if (isTarget && node.type === "project") {
          connectedEdges.push(index);
        }
      }
      // For any other edge types, use the original logic as fallback
      else {
        if (isSource || isTarget) {
          connectedEdges.push(index);
        }
      }
    });
    return connectedEdges;
  }
}
